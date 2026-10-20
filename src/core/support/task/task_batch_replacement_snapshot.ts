import type { TaskWorkspaceDocument } from "src/task_types";
import { BoundaryFailureClassifier } from "src/io/boundary_failure_classifier";
import type {
	TaskBatchReplacementSnapshotContract,
	TaskPublicationLockContract,
	TaskPublicationRecoveryContract,
} from "src/core/support/task/types";

/** Responsibilities: _batch rollback state_, _transaction location_. **/
export class TaskBatchReplacementSnapshot implements TaskBatchReplacementSnapshotContract {
	private readonly boundary_failures: BoundaryFailureClassifier;
	public readonly transaction: string;
	public readonly rules_existed: boolean;
	public readonly existing_documents: readonly TaskWorkspaceDocument[];

	/** Responsibilities: _rollback failure reporting_. **/
	private combined_rollback_failure(message: string, rollback_message: string): AggregateError {
		const publication_error = new Error(message);
		const rollback_failure = new Error(rollback_message);
		const combined_failure = new AggregateError(
			[publication_error, rollback_failure],
			`${publication_error.message}; rollback: ${rollback_failure.message}`,
		);
		combined_failure.name = "TaskPublicationRollbackError";
		return combined_failure;
	}

	/** Responsibilities: _rollback snapshot initialization_. **/
	public constructor(
		transaction: string,
		rules_existed: boolean,
		existing_documents: readonly TaskWorkspaceDocument[],
	) {
		this.boundary_failures = new BoundaryFailureClassifier();
		this.transaction = transaction;
		this.rules_existed = rules_existed;
		this.existing_documents = existing_documents;
	}

	/** Responsibilities: _recovery document membership_. **/
	public recovery_documents(): ReadonlySet<TaskWorkspaceDocument> {
		return new Set(this.existing_documents);
	}

	/** Responsibilities: _failed transaction recovery_. **/
	public restore_failure(
		message: string,
		recovery: TaskPublicationRecoveryContract,
		lock: TaskPublicationLockContract,
	): never {
		try {
			if (this.transaction.length > 0) {
				recovery.restore(this.transaction, this.rules_existed, this.recovery_documents());
			}
		} catch (rollback_error) {
			if (!this.boundary_failures.system_failure_message(String(rollback_error))) {
				throw rollback_error;
			}
			throw this.combined_rollback_failure(message, String(rollback_error));
		}
		lock.release();
		throw new Error(message);
	}
}
