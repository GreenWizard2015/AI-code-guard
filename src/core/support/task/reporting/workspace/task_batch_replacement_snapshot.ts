import type { SystemFailureClassificationContract } from "src/analysis_protocols";
import { BoundaryFailureCategory } from "src/analysis_protocols";
import type {
	TaskBatchReplacementStateContract,
	TaskPublicationLockContract,
	TaskPublicationRecoveryContract,
} from "src/core/support/task/types";
import { BoundaryFailureClassifier } from "src/io/boundary_failure_classifier";
import { SYSTEM_FAILURE_CODES } from "src/io/constants";
import type { TaskWorkspaceDocument } from "src/task_types";

/** Responsibilities: _batch rollback state_, _transaction location_. **/
export class TaskBatchReplacementSnapshot implements TaskBatchReplacementStateContract {
	private readonly _boundary_failures: SystemFailureClassificationContract;
	private readonly _transaction_value: string;
	private readonly _rules_existed_value: boolean;
	private readonly _existing_documents_value: readonly TaskWorkspaceDocument[];
	private readonly _rollback_failure_messages: Set<string>;

	/** Responsibilities: _rollback failure reporting_. **/
	private combined_rollback_failure(message: string, rollback_message: string): AggregateError {
		this._rollback_failure_messages.add(rollback_message);
		const publication_error = new Error(message);
		const rollback_failure = new Error(rollback_message);
		return new AggregateError(
			[publication_error, rollback_failure],
			`TaskPublicationRollbackError: ${publication_error.message}; rollback: ${rollback_failure.message}`,
		);
	}

	/** Responsibilities: _rollback snapshot initialization_. **/
	public constructor(
		transaction: string,
		rules_existed: boolean,
		existing_documents: readonly TaskWorkspaceDocument[],
	) {
		this._boundary_failures = new BoundaryFailureClassifier(SYSTEM_FAILURE_CODES);
		this._transaction_value = transaction;
		this._rules_existed_value = rules_existed;
		this._existing_documents_value = existing_documents;
		this._rollback_failure_messages = new Set();
	}

	/** Responsibilities: _transaction path access_. **/
	public transaction(): string {
		return this._transaction_value;
	}

	/** Responsibilities: _prior rules directory existence_. **/
	public rules_existed(): boolean {
		return this._rules_existed_value;
	}

	/** Responsibilities: _prior task document access_. **/
	public existing_documents(): readonly TaskWorkspaceDocument[] {
		return this._existing_documents_value;
	}

	/** Responsibilities: _recovery document membership_. **/
	public recovery_documents(): ReadonlySet<TaskWorkspaceDocument> {
		return new Set(this._existing_documents_value);
	}

	/** Responsibilities: _rollback failure state_. **/
	public rollback_failed(): boolean {
		return this._rollback_failure_messages.size > 0;
	}

	/** Responsibilities: _retained transaction recovery_. **/
	public restore(recovery: TaskPublicationRecoveryContract, lock: TaskPublicationLockContract): void {
		if (this._transaction_value.length > 0) {
			recovery.for_transaction(this._transaction_value).restore(this._rules_existed_value, this.recovery_documents());
		}
		lock.release();
	}

	/** Responsibilities: _failed transaction recovery_. **/
	public restore_failure(
		message: string,
		recovery: TaskPublicationRecoveryContract,
		lock: TaskPublicationLockContract,
	): never {
		try {
			this.restore(recovery, lock);
		} catch (rollback_error) {
			if (!this._boundary_failures.check(String(rollback_error), BoundaryFailureCategory.System)) {
				throw rollback_error;
			}
			throw this.combined_rollback_failure(message, String(rollback_error));
		}
		throw new Error(message);
	}
}
