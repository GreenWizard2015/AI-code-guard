import { randomUUID } from "node:crypto";
import { dirname, join, resolve } from "node:path";
import {
	TASK_PUBLICATION_JOURNAL_COMMITTED,
	TASK_PUBLICATION_JOURNAL_PREPARED,
	TASK_PUBLICATION_TRANSACTION_PREFIX,
} from "src/core/support/task/constants";
import { TaskPublicationJournal } from "src/core/support/task/publication/task_publication_journal";
import { TaskPublicationJournalFile } from "src/core/support/task/publication/task_publication_journal_file";
import { TaskPublicationOwner } from "src/core/support/task/publication/task_publication_owner";
import { TaskPublicationRecoveryClaim } from "src/core/support/task/publication/task_publication_recovery_claim";
import type {
	TaskPublicationLockContract,
	TaskPublicationOwnerContract,
	TaskPublicationRecoveryContract,
} from "src/core/support/task/types";
import { TEST_SCOPE_DIRECTORIES } from "src/constants";
import { DIRECTORY_ENTRY_DIRECTORY } from "src/io/constants";
import type { TaskWorkspaceDocument } from "src/types";
import type { IOContract } from "src/io/protocols";

/** Responsibilities: _task publication ownership_, _abandoned transaction recovery_. **/
export class TaskPublicationLock implements TaskPublicationLockContract {
	private readonly workspace_root: string;
	private readonly lock_path: string;
	private readonly recovery: TaskPublicationRecoveryContract;
	private readonly owner_token: string;
	private readonly recovery_claim: TaskPublicationRecoveryClaim;
	private readonly acquisition_staging_path: string;
	private readonly acquisition_owner_content: string;
	private readonly file_io: IOContract;

	/** Responsibilities: _atomic publication metadata replacement_. **/
	private write_atomically(path: string, temporary_path: string, content: string): void {
		try {
			this.file_io.file_content.write_text(temporary_path, content);
			this.file_io.directory_operations.move_path(temporary_path, path);
		} catch (error) {
			this.file_io.directory_operations.remove_path(temporary_path);
			throw error;
		}
	}

	/** Responsibilities: _publication owner state_. **/
	private owner_state(): TaskPublicationOwnerContract {
		const path = join(this.lock_path, "owner");
		if (this.file_io.directory_entries.path_kind(path) !== "file") {
			return new TaskPublicationOwner(0, "", "");
		}
		const [pid_text, transaction = "", token = ""] = this.file_io.file_content.file_text(path).split("\n");
		const pid = Number(pid_text);
		return new TaskPublicationOwner(pid, transaction.trim(), token.trim());
	}

	/** Responsibilities: _publication transaction boundary_. **/
	private valid_transaction(transaction: string): boolean {
		const transaction_root = resolve(dirname(this.workspace_root));
		const expected_prefix = join(transaction_root, TASK_PUBLICATION_TRANSACTION_PREFIX);
		return resolve(transaction).startsWith(expected_prefix);
	}

	/** Responsibilities: _abandoned publication recovery_. **/
	private recover_transaction(transaction: string): void {
		if (!this.valid_transaction(transaction)) {
			throw new Error(`Task publication transaction is outside the workspace: ${transaction}`);
		}
		const journal_file = new TaskPublicationJournalFile(join(transaction, "journal"), this.file_io);
		const state = journal_file.state();
		const journal = new TaskPublicationJournal(state);
		if (!journal.valid()) {
			throw new Error(`Task publication transaction journal is unavailable: ${transaction}`);
		}
		if (journal.committed()) {
			this.file_io.directory_operations.remove_path(transaction);
			return;
		}
		this.recovery.restore(transaction, journal.rules_to_restore(), new Set(journal.prior_documents()));
	}

	/** Responsibilities: _abandoned transaction restoration_. **/
	private recover_owner_transaction(owner: TaskPublicationOwnerContract): void {
		const transaction = owner.abandoned_transaction();
		if (transaction.length === 0) {
			return;
		}
		if (!this.valid_transaction(transaction)) {
			throw new Error(`Task publication transaction is outside the workspace: ${transaction}`);
		}
		if (this.file_io.file_paths.path_exists(transaction)) {
			this.recover_transaction(transaction);
		}
	}

	/** Responsibilities: _recovery owner identity revalidation_. **/
	private assert_recovery_owner(owner: TaskPublicationOwnerContract): void {
		const current = this.owner_state();
		if (!this.recovery_claim.same_owner(owner, current)) {
			throw new Error(`Task publication lock owner changed during recovery: ${this.lock_path}`);
		}
	}

	/** Responsibilities: _recovery claim finalization_. **/
	private finish_recovery(owner: TaskPublicationOwnerContract, recovery_claim: string): void {
		try {
			this.assert_recovery_owner(owner);
			this.recover_owner_transaction(owner);
			this.assert_recovery_owner(owner);
			this.file_io.directory_operations.remove_path(this.lock_path);
		} catch (error) {
			this.file_io.directory_operations.remove_path(recovery_claim);
			throw error;
		}
	}

	/** Responsibilities: _abandoned publication recovery_. **/
	private recover_abandoned_lock(): void {
		const owner_path = join(this.lock_path, "owner");
		if (!this.file_io.file_paths.path_exists(owner_path)) {
			this.file_io.directory_operations.remove_path(this.lock_path);
			return;
		}
		const owner = this.owner_state();
		if (!owner.valid()) {
			throw new Error(`Task publication lock has invalid ownership metadata: ${this.lock_path}`);
		}
		if (owner.live()) {
			throw new Error(`Task publication lock is owned by a live or unverifiable process: ${this.lock_path}`);
		}
		const recovery_claim = join(this.lock_path, TEST_SCOPE_DIRECTORIES.operational[1]);
		this.recovery_claim.claim(recovery_claim);
		this.finish_recovery(owner, recovery_claim);
	}

	/** Responsibilities: _staged lock publication_. **/
	private publish_lock(): boolean {
		try {
			this.file_io.directory_operations.move_path(this.acquisition_staging_path, this.lock_path);
			return true;
		} catch (error) {
			if (this.file_io.file_paths.path_exists(this.lock_path)) {
				if (this.file_io.directory_entries.path_kind(this.lock_path) === DIRECTORY_ENTRY_DIRECTORY) {
					return false;
				}
			}
			throw error;
		}
	}

	/** Responsibilities: _atomic lock acquisition_. **/
	private acquire_lock(): boolean {
		try {
			this.file_io.directory_operations.create_directory_exclusive(this.acquisition_staging_path);
			this.file_io.file_content.write_text(
				join(this.acquisition_staging_path, "owner"),
				this.acquisition_owner_content,
			);
			return this.publish_lock();
		} finally {
			this.file_io.directory_operations.remove_path(this.acquisition_staging_path);
		}
	}

	/** Responsibilities: _publication lock_. **/
	public constructor(workspace_root: string, recovery: TaskPublicationRecoveryContract, file_io: IOContract) {
		this.workspace_root = workspace_root;
		this.lock_path = join(workspace_root, ".task-publication-lock");
		this.recovery = recovery;
		this.owner_token = randomUUID();
		this.file_io = file_io;
		this.recovery_claim = new TaskPublicationRecoveryClaim(this.lock_path, this.owner_token, file_io);
		this.acquisition_staging_path = `${this.lock_path}.${this.owner_token}.initializing`;
		this.acquisition_owner_content = `${String(process.pid)}\n\n${this.owner_token}\n`;
	}

	/** Responsibilities: _publication lock acquisition_. **/
	public acquire(): void {
		if (this.acquire_lock()) {
			return;
		}
		this.recover_abandoned_lock();
		if (!this.acquire_lock()) {
			throw new Error(`Task publication lock changed during acquisition: ${this.lock_path}`);
		}
	}

	/** Responsibilities: _publication transaction ownership_. **/
	public begin_transaction(transaction: string): void {
		if (!this.valid_transaction(transaction)) {
			throw new Error(`Task publication transaction is outside the workspace: ${transaction}`);
		}
		const owner_path = join(this.lock_path, "owner");
		this.write_atomically(owner_path, `${owner_path}.next`, `${process.pid}\n${transaction}\n${this.owner_token}\n`);
	}

	/** Responsibilities: _publication journal persistence_. **/
	public write_journal(
		transaction: string,
		rules_existed: boolean,
		existing_documents: ReadonlySet<TaskWorkspaceDocument>,
	): void {
		const path = join(transaction, "journal");
		const journal_lines = [TASK_PUBLICATION_JOURNAL_PREPARED, `${rules_existed ? "1" : "0"}`, ...existing_documents];
		const content = journal_lines.join("\n");
		this.file_io.file_content.write_text(path, content);
	}

	/** Responsibilities: _publication commit phase persistence_. **/
	public commit_transaction(transaction: string): void {
		const path = join(transaction, "journal");
		const lines = this.file_io.file_content.file_text(path).split("\n");
		lines[0] = TASK_PUBLICATION_JOURNAL_COMMITTED;
		this.write_atomically(path, `${path}.next`, lines.join("\n"));
	}

	/** Responsibilities: _publication lock ownership_. **/
	public release(): void {
		const owner = this.owner_state();
		if (!owner.owns_token(this.owner_token)) {
			return;
		}
		this.file_io.directory_operations.remove_path(this.lock_path);
	}
}
