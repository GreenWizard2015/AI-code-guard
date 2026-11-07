import { join } from "node:path";
import type {
	TaskPublicationOwnerContract,
	TaskPublicationRecoveryContract,
	TaskPublicationRollbackContract,
} from "src/core/support/task/types";
import type { IOContract } from "src/io/protocols";
import type { TaskWorkspaceDocument } from "src/task_types";
import type { TaskReportingMemoryWorkspace } from "tests/bridge/ts/core/support/task-reporting-memory-workspace";

/** Responsibilities: _owner replacement state_, _rollback behavior_. **/
export class OwnerChangeRecovery implements TaskPublicationRecoveryContract, TaskPublicationRollbackContract {
	private readonly _file_io: IOContract;
	private readonly _lock_path: string;
	private readonly _transaction: string;
	private readonly _restore: TaskPublicationRollbackContract["restore"];

	/** Responsibilities: _owner replacement lock setup_. **/
	public constructor(fixture: TaskReportingMemoryWorkspace, restore: TaskPublicationRollbackContract["restore"]) {
		const { _root, _file_io: file_io } = fixture;
		this._file_io = file_io;
		this._restore = restore;
		this._transaction = file_io.temporary_directory(_root, ".ai-code-guard-task-");
		file_io.file(join(this._transaction, "journal")).write_text("prepared\n0");
		const workspace = join(_root, ".ai-code-guard");
		this._lock_path = join(workspace, ".task-publication-lock");
		file_io.create_directory(this._lock_path);
		file_io.file(join(this._lock_path, "owner")).write_text(`999999999\n${this._transaction}\noriginal-token\n`);
	}

	/** Responsibilities: _transaction rollback selection_. **/
	public for_transaction(_transaction: string): TaskPublicationRollbackContract {
		return this;
	}

	/** Responsibilities: _empty transaction backup snapshot_. **/
	public backup_documents(): Map<TaskWorkspaceDocument, string> {
		return new Map();
	}

	/** Responsibilities: _delegated document backup restoration_. **/
	public restore(rules_existed: boolean, existing_documents: ReadonlySet<TaskWorkspaceDocument>): void {
		this._restore(rules_existed, existing_documents);
	}

	/** Responsibilities: _replacement owner record update_. **/
	public recover_abandoned_transaction(_owner: TaskPublicationOwnerContract): void {
		this._file_io
			.file(join(this._lock_path, "owner"))
			.write_text(`${process.pid}\n${this._transaction}\nreplacement-token\n`);
	}

	/** Responsibilities: _empty existing document snapshot_. **/
	public existing_documents(): ReadonlySet<TaskWorkspaceDocument> {
		return new Set();
	}
}
