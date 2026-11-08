import type { IOContract } from "src/io/protocols";
import type { TaskWorkspaceDocument } from "src/task_types";

export type TaskSourceText = {
	available: boolean;
	lines: readonly string[];
};

export type TaskPublicationJournalState = {
	committed: boolean;
	rules_existed: boolean;
	existing_documents: readonly TaskWorkspaceDocument[];
	valid_rules_line: boolean;
	valid_documents: boolean;
};
export type TaskPublicationJournalDocumentState = {
	existing_documents: TaskWorkspaceDocument[];
	valid_documents: boolean;
};
export type TaskPublicationJournalPhase = { name: string; index: number };

/** Responsibilities: _publication rollback snapshot_. **/
export interface TaskBatchReplacementStateContract {
	transaction(): string;
	rules_existed(): boolean;
	existing_documents(): readonly TaskWorkspaceDocument[];
	recovery_documents(): ReadonlySet<TaskWorkspaceDocument>;
	rollback_failed(): boolean;
	restore(recovery: TaskPublicationRecoveryContract, lock: TaskPublicationLockContract): void;
	restore_failure(message: string, recovery: TaskPublicationRecoveryContract, lock: TaskPublicationLockContract): never;
}

/** Responsibilities: _publication owner_. **/
export interface TaskPublicationOwnerContract {
	abandoned_transaction(): string;
	owns_token(token: string): boolean;
	same_token(owner: TaskPublicationOwnerContract): boolean;
	valid(): boolean;
	live(): boolean;
}

/** Responsibilities: _publication journal_. **/
export interface TaskPublicationJournalContract {
	committed(): boolean;
	rules_to_restore(): boolean;
	valid(): boolean;
	prior_documents(): readonly TaskWorkspaceDocument[];
}

/** Responsibilities: _publication recovery_. **/
export interface TaskPublicationRecoveryContract {
	for_transaction(transaction: string): TaskPublicationRollbackContract;
	existing_documents(): ReadonlySet<TaskWorkspaceDocument>;
	recover_abandoned_transaction(owner: TaskPublicationOwnerContract): void;
}

/** Responsibilities: _transaction backup restoration_. **/
export interface TaskPublicationRollbackContract {
	backup_documents(): Map<TaskWorkspaceDocument, string>;
	restore(rules_existed: boolean, existing_documents: ReadonlySet<TaskWorkspaceDocument>): void;
}

/** Responsibilities: _publication lock_. **/
export interface TaskPublicationLockContract {
	acquire(): void;
	transaction(path: string): TaskPublicationTransactionContract;
	release(): void;
}

/** Responsibilities: _publication transaction operations_. **/
export interface TaskPublicationTransactionContract {
	begin(): void;
	write_journal(rules_existed: boolean, documents: ReadonlySet<TaskWorkspaceDocument>): void;
	commit(): void;
}

/** Responsibilities: _transaction path access_, _path ownership validation_. **/
export interface TaskPublicationTransactionPathContract {
	value(): string;
	validate(): void;
}

export type TaskPublicationTransactionOptions = {
	lock_path: string;
	owner_token: string;
	process_identity: string;
	path: TaskPublicationTransactionPathContract;
	file_io: IOContract;
};
