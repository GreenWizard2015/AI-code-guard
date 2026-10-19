import { join } from "node:path";
import { TaskRuleDocumentation } from "src/core/support/task/reporting/task_rule_documentation";
import { InMemoryFileIO } from "tests/bridge/ts/core/cache/in_memory_file_io";

/** Responsibilities: _task document path lookup_, _in-memory task documents_. **/
export class TaskReportingMemoryWorkspace {
	public readonly root: string;
	public readonly file_io: InMemoryFileIO;
	public readonly documentation: TaskRuleDocumentation;

	/** Responsibilities: _task document workspace state_. **/
	public constructor(root: string, file_io: InMemoryFileIO, documentation: TaskRuleDocumentation) {
		this.root = root;
		this.file_io = file_io;
		this.documentation = documentation;
	}

	/** Responsibilities: _task document path lookup_. **/
	public task_path(file: string): string {
		return join(this.root, ".ai-code-guard", file);
	}

	/** Responsibilities: _task document text lookup_. **/
	public task_text(file: string): string {
		return this.file_io.file_content.file_text(this.task_path(file));
	}
}
