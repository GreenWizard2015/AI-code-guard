import type { TaskWorkspaceDocument } from "src/types";
import { TaskPublicationRollbackError } from "src/core/support/task/publication/task_publication_rollback_error";
import type {
	TaskBatchReplacementSnapshotContract,
	TaskPublicationLockContract,
	TaskPublicationRecoveryContract,
} from "src/core/support/task/types";

/** Responsibilities: _batch rollback state_, _transaction location_. **/
export class TaskBatchReplacementSnapshot implements TaskBatchReplacementSnapshotContract {
	public readonly transaction: string;
	public readonly rules_existed: boolean;
	public readonly existing_documents: readonly TaskWorkspaceDocument[];

	/** Responsibilities: _rollback snapshot initialization_. **/
	public constructor(
		transaction: string,
		rules_existed: boolean,
		existing_documents: readonly TaskWorkspaceDocument[],
	) {
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
			throw new TaskPublicationRollbackError(`${message}; rollback: ${String(rollback_error)}`);
		}
		lock.release();
		throw new Error(message);
	}
}
