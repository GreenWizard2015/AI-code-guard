import { join, resolve } from "node:path";
import { LINT_OUTPUT_DOCUMENT } from "src/core/support/task/constants";
import { TaskBatchReplacement } from "src/core/support/task/task_batch_replacement";
import { TaskWorkspaceDocuments } from "src/core/support/task/task_workspace_documents";
import { AI_CODE_GUARD_DIRECTORY } from "src/constants";
import type {
	TaskBatchReplacementContract,
	TaskWorkspaceContract,
	TaskWorkspaceDocumentsContract,
} from "src/protocols";
import type { IOContract } from "src/io/protocols";

/** Responsibilities: _workspace state_, _document preparation_. **/
export class TaskWorkspace implements TaskWorkspaceContract {
	public readonly documents: TaskWorkspaceDocumentsContract;
	public readonly batch: TaskBatchReplacementContract;
	private readonly workspace_root: string;
	private readonly rules_root: string;
	private readonly file_io: IOContract;

	/** Responsibilities: _task workspace lifecycle initialization_. **/
	public constructor(root: string, file_io: IOContract) {
		this.workspace_root = resolve(root, AI_CODE_GUARD_DIRECTORY);
		this.rules_root = join(this.workspace_root, "rules");
		this.file_io = file_io;
		this.documents = new TaskWorkspaceDocuments(root, file_io);
		this.batch = new TaskBatchReplacement(this.documents, this.workspace_root, this.rules_root, file_io);
	}

	/** Responsibilities: _current task issue cleanup_. **/
	public clear_batch(): void {
		this.prepare_review();
		this.file_io.directory_operations.remove_path(this.rules_root);
		this.file_io.directory_operations.create_directory(this.rules_root);
		for (const document of ["issues", "report", LINT_OUTPUT_DOCUMENT] as const) {
			this.file_io.directory_operations.remove_path(this.documents.path_for_document(document));
		}
	}

	/** Responsibilities: _architecture review workspace preparation_. **/
	public prepare_review(): void {
		this.file_io.directory_operations.create_directory(this.workspace_root);
		this.file_io.directory_operations.create_directory(join(this.workspace_root, "review"));
		this.file_io.directory_operations.remove_path(join(this.workspace_root, "architecture-review-prompt.md"));
	}
}
