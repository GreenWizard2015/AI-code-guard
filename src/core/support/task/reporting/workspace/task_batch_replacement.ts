import { basename, dirname, join } from "node:path";
import { BoundaryFailureCategory } from "src/analysis_protocols";
import type { SystemFailureClassificationContract } from "src/analysis_protocols";
import { TASK_PUBLICATION_TRANSACTION_PREFIX } from "src/core/support/task/constants";
import { TaskPublicationRecovery } from "src/core/support/task/publication/task_publication_recovery";
import { TaskBatchReplacementSnapshot } from "src/core/support/task/reporting/workspace/task_batch_replacement_snapshot";
import { TaskPublicationLock } from "src/core/support/task/reporting/workspace/task_publication_lock";
import type {
	TaskBatchReplacementStateContract,
	TaskPublicationLockContract,
	TaskPublicationRecoveryContract,
	TaskPublicationTransactionContract,
} from "src/core/support/task/types";
import { BoundaryFailureClassifier } from "src/io/boundary_failure_classifier";
import { SYSTEM_FAILURE_CODES } from "src/io/constants";
import type { IOContract } from "src/io/protocols";
import type { TaskBatchReplacementContract, TaskWorkspaceDocumentsContract } from "src/task_protocols";
import type { TaskBatchReplacementOptions, TaskWorkspaceDocument } from "src/task_types";

/** Responsibilities: _task batch publication_, _workspace rollback_. **/
export class TaskBatchReplacement implements TaskBatchReplacementContract {
	private readonly _documents: TaskWorkspaceDocumentsContract;
	private readonly _workspace_root: string;
	private readonly _rules_root: string;
	private readonly _publication_recovery: TaskPublicationRecoveryContract;
	private readonly _publication_lock: TaskPublicationLockContract;
	private readonly _file_io: IOContract;
	private readonly _boundary_failures: SystemFailureClassificationContract;
	private readonly _failed_snapshots: Map<string, TaskBatchReplacementStateContract>;
	private readonly _pending_cleanup: Set<string>;

	/** Responsibilities: _failed transaction recovery_. **/
	private recover_failed_snapshot(): void {
		for (const [transaction, snapshot] of this._failed_snapshots) {
			snapshot.restore(this._publication_recovery, this._publication_lock);
			this._failed_snapshots.delete(transaction);
		}
	}

	/** Responsibilities: _pending cleanup recovery_. **/
	private recover_pending_cleanup(): void {
		for (const transaction of this._pending_cleanup) {
			if (this._file_io.file(transaction).path_exists()) {
				this._file_io.remove_path(transaction);
			}
			this._publication_lock.release();
			this._pending_cleanup.delete(transaction);
		}
	}

	/** Responsibilities: _staged task document writing_. **/
	private write_documents(issues: string, documents: ReadonlyMap<TaskWorkspaceDocument, string>): void {
		this._documents.write_document("issues", issues);
		for (const [document, content] of documents) {
			if (document !== "issues") {
				this._documents.write_document(document, content);
			}
		}
	}

	/** Responsibilities: _prior task document backup_. **/
	private backup_documents(backups: ReadonlyMap<TaskWorkspaceDocument, string>): void {
		for (const [document, backup] of backups) {
			const current = this._documents.path_for_document(document);
			if (this._file_io.file(current).path_exists()) {
				this._file_io.move_path(current, backup);
			}
		}
	}

	/** Responsibilities: _staged rule copying_. **/
	private copy_staged_rules(rule_ids: readonly string[], staged_rules: string): void {
		this._file_io.create_directory(this._rules_root);
		for (const rule_id of rule_ids) {
			const staged_file = join(staged_rules, basename(this._documents.rule_document_path(rule_id)));
			this._file_io.file(staged_file).copy_to(this._file_io.file(this._documents.rule_document_path(rule_id)));
		}
	}

	/** Responsibilities: _task batch staging_. **/
	private stage(options: TaskBatchReplacementOptions, snapshot: TaskBatchReplacementStateContract): void {
		const transaction = snapshot.transaction();
		const backups = this._publication_recovery.for_transaction(transaction).backup_documents();
		if (this._file_io.file(this._rules_root).path_exists()) {
			this._file_io.move_path(this._rules_root, join(transaction, "rules"));
		}
		this.backup_documents(backups);
		this.copy_staged_rules(options.rule_ids, options.staged_rules);
		this.write_documents(options.issues, options.documents);
	}

	/** Responsibilities: _transaction cleanup_. **/
	private cleanup_transaction(transaction: string): void {
		try {
			this._file_io.remove_path(transaction);
			this._publication_lock.release();
		} catch (error) {
			this._pending_cleanup.add(transaction);
			throw error;
		}
	}

	/** Responsibilities: _failed transaction cleanup_. **/
	private cleanup_failed_transaction(transaction: string): string {
		try {
			this.cleanup_transaction(transaction);
			return "";
		} catch (cleanup_error) {
			if (!this._boundary_failures.check(String(cleanup_error), BoundaryFailureCategory.System)) {
				throw cleanup_error;
			}
			return String(cleanup_error);
		}
	}

	/** Responsibilities: _transaction directory creation_. **/
	private create_transaction_directory(): string {
		try {
			return this._file_io.temporary_directory(dirname(this._workspace_root), TASK_PUBLICATION_TRANSACTION_PREFIX);
		} catch (error) {
			try {
				this._publication_lock.release();
			} catch (cleanup_error) {
				if (!this._boundary_failures.check(String(cleanup_error), BoundaryFailureCategory.System)) {
					throw cleanup_error;
				}
				throw new AggregateError([error, cleanup_error], `${String(error)}; transaction cleanup also failed.`);
			}
			throw error;
		}
	}

	/** Responsibilities: _transaction snapshot recording_. **/
	private capture_transaction_snapshot(
		transaction_directory: string,
		publication: TaskPublicationTransactionContract,
	): TaskBatchReplacementStateContract {
		const rules_existed = this._file_io.file(this._rules_root).path_exists();
		const existing_documents = [...this._publication_recovery.existing_documents()];
		const snapshot = new TaskBatchReplacementSnapshot(transaction_directory, rules_existed, existing_documents);
		publication.write_journal(rules_existed, snapshot.recovery_documents());
		return snapshot;
	}

	/** Responsibilities: _transaction initialization_. **/
	private begin_transaction(): TaskBatchReplacementStateContract {
		const transaction = this.create_transaction_directory();
		const publication = this._publication_lock.transaction(transaction);
		try {
			publication.begin();
			return this.capture_transaction_snapshot(transaction, publication);
		} catch (error) {
			const cleanup_failure = this.cleanup_failed_transaction(transaction);
			if (cleanup_failure.length > 0) {
				throw new AggregateError(
					[error, new Error(cleanup_failure)],
					`${String(error)}; transaction cleanup also failed.`,
				);
			}
			throw error;
		}
	}

	/** Responsibilities: _failed batch restoration_. **/
	private restore_failure(snapshot: TaskBatchReplacementStateContract, message: string): void {
		try {
			snapshot.restore_failure(message, this._publication_recovery, this._publication_lock);
		} catch (rollback_error) {
			if (snapshot.rollback_failed()) {
				const transaction = snapshot.transaction();
				if (transaction.length > 0) {
					this._failed_snapshots.set(transaction, snapshot);
				}
			}
			throw rollback_error;
		}
	}

	/** Responsibilities: _task batch replacement initialization_. **/
	public constructor(
		documents: TaskWorkspaceDocumentsContract,
		workspace_root: string,
		rules_root: string,
		file_io: IOContract,
	) {
		this._documents = documents;
		this._workspace_root = workspace_root;
		this._rules_root = rules_root;
		this._file_io = file_io;
		this._boundary_failures = new BoundaryFailureClassifier(SYSTEM_FAILURE_CODES);
		this._failed_snapshots = new Map();
		this._pending_cleanup = new Set();
		this._publication_recovery = new TaskPublicationRecovery(documents, rules_root, file_io);
		this._publication_lock = new TaskPublicationLock(workspace_root, this._publication_recovery, file_io);
	}

	/** Responsibilities: _task batch publication_. **/
	public replace(options: TaskBatchReplacementOptions): void {
		this._file_io.create_directory(this._workspace_root);
		this.recover_failed_snapshot();
		this.recover_pending_cleanup();
		this._publication_lock.acquire();
		const snapshot = this.begin_transaction();
		try {
			this.stage(options, snapshot);
			this._publication_lock.transaction(snapshot.transaction()).commit();
		} catch (error) {
			this.restore_failure(snapshot, String(error));
		}
		this.cleanup_transaction(snapshot.transaction());
	}
}
