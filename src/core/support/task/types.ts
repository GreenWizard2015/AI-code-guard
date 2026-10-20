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
export interface TaskBatchReplacementSnapshotContract {
	readonly transaction: string;
	readonly rules_existed: boolean;
	readonly existing_documents: readonly TaskWorkspaceDocument[];
	recovery_documents(): ReadonlySet<TaskWorkspaceDocument>;
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
	backup_documents(transaction: string): Map<TaskWorkspaceDocument, string>;
	existing_documents(): ReadonlySet<TaskWorkspaceDocument>;
	restore(transaction: string, rules_existed: boolean, existing_documents: ReadonlySet<TaskWorkspaceDocument>): void;
}

/** Responsibilities: _publication lock_. **/
export interface TaskPublicationLockContract {
	acquire(): void;
	begin_transaction(transaction: string): void;
	write_journal(
		transaction: string,
		rules_existed: boolean,
		existing_documents: ReadonlySet<TaskWorkspaceDocument>,
	): void;
	commit_transaction(transaction: string): void;
	release(): void;
}
