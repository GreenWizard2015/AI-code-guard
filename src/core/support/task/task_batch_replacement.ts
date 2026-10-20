import { basename, dirname, join } from "node:path";
import { TASK_PUBLICATION_TRANSACTION_PREFIX } from "src/core/support/task/constants";
import { TaskPublicationRecovery } from "src/core/support/task/publication/task_publication_recovery";
import { TaskPublicationLock } from "src/core/support/task/task_publication_lock";
import { TaskBatchReplacementSnapshot } from "src/core/support/task/task_batch_replacement_snapshot";
import type {
	TaskBatchReplacementSnapshotContract,
	TaskPublicationLockContract,
	TaskPublicationRecoveryContract,
} from "src/core/support/task/types";
import type { TaskBatchReplacementContract, TaskWorkspaceDocumentsContract } from "src/task_protocols";
import type { TaskBatchReplacementOptions } from "src/task_types";
import type { IOContract } from "src/io/protocols";

/** Responsibilities: _batch staging_, _workspace rollback_. **/
export class TaskBatchReplacement implements TaskBatchReplacementContract {
	private readonly documents: TaskWorkspaceDocumentsContract;
	private readonly workspace_root: string;
	private readonly rules_root: string;
	private readonly publication_recovery: TaskPublicationRecoveryContract;
	private readonly publication_lock: TaskPublicationLockContract;
	private readonly file_io: IOContract;

	/** Responsibilities: _staged task document writing_. **/
	private write_documents(options: TaskBatchReplacementOptions): void {
		this.documents.write_document("issues", options.issues);
		for (const [document, content] of options.documents) {
			if (document !== "issues") {
				this.documents.write_document(document, content);
			}
		}
	}

	/** Responsibilities: _task batch staging_. **/
	private stage(options: TaskBatchReplacementOptions, transaction: string): void {
		const backups = this.publication_recovery.backup_documents(transaction);
		if (this.file_io.file_paths.path_exists(this.rules_root)) {
			this.file_io.directory_operations.move_path(this.rules_root, join(transaction, "rules"));
		}
		for (const [document, backup] of backups) {
			const current = this.documents.path_for_document(document);
			if (this.file_io.file_paths.path_exists(current)) {
				this.file_io.directory_operations.move_path(current, backup);
			}
		}
		this.file_io.directory_operations.create_directory(this.rules_root);
		for (const rule_id of options.rule_ids) {
			const staged_file = join(options.staged_rules, basename(this.documents.rule_document_path(rule_id)));
			this.file_io.file_operations.copy_file(staged_file, this.documents.rule_document_path(rule_id));
		}
		this.write_documents(options);
	}

	/** Responsibilities: _transaction cleanup_. **/
	private cleanup_transaction(transaction: string): void {
		try {
			this.file_io.directory_operations.remove_path(transaction);
		} finally {
			this.publication_lock.release();
		}
	}

	/** Responsibilities: _transaction journal preparation_. **/
	private begin_transaction(): TaskBatchReplacementSnapshotContract {
		const transaction = this.file_io.directory_operations.temporary_directory(
			dirname(this.workspace_root),
			TASK_PUBLICATION_TRANSACTION_PREFIX,
		);
		const rules_existed = this.file_io.file_paths.path_exists(this.rules_root);
		const existing_documents = [...this.publication_recovery.existing_documents()];
		const snapshot = new TaskBatchReplacementSnapshot(transaction, rules_existed, existing_documents);
		this.publication_lock.write_journal(transaction, rules_existed, snapshot.recovery_documents());
		this.publication_lock.begin_transaction(transaction);
		return snapshot;
	}

	/** Responsibilities: _locked task batch publication_. **/
	private replace_locked(options: TaskBatchReplacementOptions): void {
		let snapshot: TaskBatchReplacementSnapshotContract = new TaskBatchReplacementSnapshot("", false, []);
		try {
			snapshot = this.begin_transaction();
			this.stage(options, snapshot.transaction);
			this.publication_lock.commit_transaction(snapshot.transaction);
		} catch (error) {
			snapshot.restore_failure(String(error), this.publication_recovery, this.publication_lock);
		}
		this.cleanup_transaction(snapshot.transaction);
	}

	/** Responsibilities: _task batch replacement initialization_. **/
	public constructor(
		documents: TaskWorkspaceDocumentsContract,
		workspace_root: string,
		rules_root: string,
		file_io: IOContract,
	) {
		this.documents = documents;
		this.workspace_root = workspace_root;
		this.rules_root = rules_root;
		this.file_io = file_io;
		this.publication_recovery = new TaskPublicationRecovery(documents, rules_root, file_io);
		this.publication_lock = new TaskPublicationLock(workspace_root, this.publication_recovery, file_io);
	}

	/** Responsibilities: _task batch publication_. **/
	public replace(options: TaskBatchReplacementOptions): void {
		this.file_io.directory_operations.create_directory(this.workspace_root);
		this.publication_lock.acquire();
		this.replace_locked(options);
		this.publication_lock.release();
	}
}
