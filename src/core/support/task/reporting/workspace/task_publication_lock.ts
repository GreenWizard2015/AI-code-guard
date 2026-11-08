import { randomUUID } from "node:crypto";
import { dirname, join } from "node:path";
import { TASK_PUBLICATION_LOCK_DIRECTORY } from "src/core/support/task/constants";
import { TaskPublicationOwner } from "src/core/support/task/publication/task_publication_owner";
import { TaskPublicationRecoveryClaim } from "src/core/support/task/publication/task_publication_recovery_claim";
import { TaskPublicationTransaction } from "src/core/support/task/publication/task_publication_transaction";
import { TaskPublicationTransactionPath } from "src/core/support/task/publication/task_publication_transaction_path";
import { NodeProcessSignal } from "src/core/support/task/review-agent/process/node_process_signal";
import { ReviewAgentIdentity } from "src/core/support/task/review_agent_identity";
import type {
	TaskPublicationLockContract,
	TaskPublicationOwnerContract,
	TaskPublicationRecoveryContract,
	TaskPublicationTransactionContract,
} from "src/core/support/task/types";
import type { IOContract } from "src/io/protocols";
import { TEST_SCOPE_DIRECTORIES } from "src/linting/constants";

/** Responsibilities: _task publication ownership_, _abandoned transaction recovery_. **/
export class TaskPublicationLock implements TaskPublicationLockContract {
	private readonly _workspace_root: string;
	private readonly _lock_path: string;
	private readonly _recovery: TaskPublicationRecoveryContract;
	private readonly _owner_token: string;
	private readonly _recovery_claim: TaskPublicationRecoveryClaim;
	private readonly _acquisition_staging_path: string;
	private readonly _acquisition_owner_content: string;
	private readonly _process_identity: string;
	private readonly _file_io: IOContract;

	/** Responsibilities: _publication owner state_. **/
	private owner_state(): TaskPublicationOwnerContract {
		const path = join(this._lock_path, "owner");
		if (!this._file_io.path_is_file(path)) {
			return new TaskPublicationOwner(0, "", "", "", this._file_io);
		}
		const [pid_text, transaction = "", token = "", start_time = "", boot_id = ""] = this._file_io
			.file(path)
			.file_text()
			.split("\n");
		const pid = Number(pid_text);
		let process_identity = "";
		if (start_time.length > 0 && boot_id.length > 0) {
			process_identity = `${pid}\n${start_time}\n${boot_id}\n`;
		}
		return new TaskPublicationOwner(pid, transaction.trim(), token.trim(), process_identity, this._file_io);
	}

	/** Responsibilities: _recovery claim finalization_. **/
	private finish_recovery(owner: TaskPublicationOwnerContract, recovery_claim: string): void {
		try {
			const initial_owner = this.owner_state();
			if (!this._recovery_claim.same_owner(owner, initial_owner)) {
				throw new Error(`Task publication lock owner changed during recovery: ${this._lock_path}`);
			}
			this._recovery.recover_abandoned_transaction(owner);
			const final_owner = this.owner_state();
			if (!this._recovery_claim.same_owner(owner, final_owner)) {
				throw new Error(`Task publication lock owner changed during recovery: ${this._lock_path}`);
			}
			this._file_io.remove_path(this._lock_path);
		} catch (error) {
			this._file_io.remove_path(recovery_claim);
			throw error;
		}
	}

	/** Responsibilities: _abandoned publication recovery_. **/
	private recover_abandoned_lock(): void {
		const owner_path = join(this._lock_path, "owner");
		if (!this._file_io.file(owner_path).path_exists()) {
			this._file_io.remove_path(this._lock_path);
			return;
		}
		const owner = this.owner_state();
		if (!owner.valid()) {
			throw new Error(`Task publication lock has invalid ownership metadata: ${this._lock_path}`);
		}
		if (owner.live()) {
			throw new Error(`Task publication lock is owned by a live or unverifiable process: ${this._lock_path}`);
		}
		const recovery_claim = join(this._lock_path, TEST_SCOPE_DIRECTORIES.operational[1]);
		this._recovery_claim.claim();
		this.finish_recovery(owner, recovery_claim);
	}

	/** Responsibilities: _staged lock publication_. **/
	private publish_lock(): boolean {
		try {
			this._file_io.move_path(this._acquisition_staging_path, this._lock_path);
			return true;
		} catch (error) {
			if (this._file_io.file(this._lock_path).path_exists()) {
				if (this._file_io.path_is_directory(this._lock_path)) {
					return false;
				}
			}
			throw error;
		}
	}

	/** Responsibilities: _atomic lock acquisition_. **/
	private acquire_lock(): boolean {
		try {
			this._file_io.create_directory_exclusive(this._acquisition_staging_path);
			this._file_io.file(join(this._acquisition_staging_path, "owner")).write_text(this._acquisition_owner_content);
			return this.publish_lock();
		} finally {
			this._file_io.remove_path(this._acquisition_staging_path);
		}
	}

	/** Responsibilities: _publication lock_. **/
	public constructor(workspace_root: string, recovery: TaskPublicationRecoveryContract, file_io: IOContract) {
		this._workspace_root = workspace_root;
		this._lock_path = join(workspace_root, TASK_PUBLICATION_LOCK_DIRECTORY);
		this._recovery = recovery;
		this._owner_token = randomUUID();
		this._file_io = file_io;
		this._recovery_claim = new TaskPublicationRecoveryClaim(
			this._lock_path,
			join(this._lock_path, TEST_SCOPE_DIRECTORIES.operational[1]),
			this._owner_token,
			file_io,
			new NodeProcessSignal(process, file_io, process.platform),
		);
		this._acquisition_staging_path = `${this._lock_path}.${this._owner_token}.initializing`;
		const identity_reader = new ReviewAgentIdentity({
			pid: 0,
			start_time: "",
			boot_id: "",
			available: false,
			file_io,
			ownership_token: "",
		});
		this._process_identity = identity_reader.from_process({ value: process.pid }).serialized();
		const [, start_time = "", boot_id = ""] = this._process_identity.split("\n");
		this._acquisition_owner_content = `${String(process.pid)}\n\n${this._owner_token}\n${start_time}\n${boot_id}\n`;
	}

	/** Responsibilities: _publication lock acquisition_. **/
	public acquire(): void {
		if (this.acquire_lock()) {
			return;
		}
		this.recover_abandoned_lock();
		if (!this.acquire_lock()) {
			throw new Error(`Task publication lock changed during acquisition: ${this._lock_path}`);
		}
	}

	/** Responsibilities: _publication transaction ownership_. **/
	public transaction(path: string): TaskPublicationTransactionContract {
		const transaction_path = new TaskPublicationTransactionPath(path, dirname(this._workspace_root), this._file_io);
		return new TaskPublicationTransaction({
			lock_path: this._lock_path,
			owner_token: this._owner_token,
			process_identity: this._process_identity,
			path: transaction_path,
			file_io: this._file_io,
		});
	}

	/** Responsibilities: _publication lock ownership_. **/
	public release(): void {
		const owner = this.owner_state();
		if (!owner.owns_token(this._owner_token)) {
			return;
		}
		this._file_io.remove_path(this._lock_path);
	}
}
