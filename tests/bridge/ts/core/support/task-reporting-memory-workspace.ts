import { join } from "node:path";
import type { TaskRuleDocumentation } from "src/core/support/task/reporting/task_rule_documentation";
import { TaskBatchReplacement } from "src/core/support/task/reporting/workspace/task_batch_replacement";
import { TaskWorkspace } from "src/core/support/task/reporting/workspace/task_workspace";
import type { IOContract } from "src/io/protocols";
import type { TaskBatchReplacementContract, TaskWorkspaceDocumentsContract } from "src/task_protocols";
import type { InMemoryFileIO } from "tests/bridge/ts/core/cache/in_memory_file_io";

/** Responsibilities: _task document path lookup_, _in-memory task documents_. **/
export class TaskReportingMemoryWorkspace<FileIO extends IOContract = InMemoryFileIO> {
	public readonly _root: string;
	public readonly _file_io: FileIO;
	public readonly _documentation: TaskRuleDocumentation;
	public readonly _workspace: TaskWorkspace;
	public readonly _documents: TaskWorkspaceDocumentsContract;
	public readonly _batch: TaskBatchReplacementContract;

	/** Responsibilities: _task document workspace state_. **/
	public constructor(root: string, file_io: FileIO, documentation: TaskRuleDocumentation) {
		this._root = root;
		this._file_io = file_io;
		this._documentation = documentation;
		this._workspace = new TaskWorkspace(root, file_io);
		const workspace_root = join(root, ".ai-code-guard");
		this._documents = this._workspace;
		this._batch = new TaskBatchReplacement(this._documents, workspace_root, join(workspace_root, "rules"), file_io);
	}

	/** Responsibilities: _task document path lookup_. **/
	public task_path(file: string): string {
		return join(this._root, ".ai-code-guard", file);
	}

	/** Responsibilities: _task document text lookup_. **/
	public task_text(file: string): string {
		return this._file_io.file(this.task_path(file)).file_text();
	}
}
