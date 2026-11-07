import { dirname, join } from "node:path";
import { TaskRuleDocumentation } from "src/core/support/task/reporting/task_rule_documentation";
import { TaskBatchReplacement } from "src/core/support/task/reporting/workspace/task_batch_replacement";
import { TaskWorkspace } from "src/core/support/task/reporting/workspace/task_workspace";
import { ViolationValue } from "src/model/violation_value";
import type { TaskBatchReplacementContract, TaskWorkspaceDocumentsContract } from "src/task_protocols";
import { InMemoryFileIO } from "tests/bridge/ts/core/cache/in_memory_file_io";

/** Responsibilities: _virtual issue-report state_, _source-backed violation creation_. **/
export class TaskIssueDocumentFixture {
	public readonly _file_io: InMemoryFileIO;
	public readonly _documents: TaskWorkspaceDocumentsContract;
	public readonly _batch: TaskBatchReplacementContract;
	public readonly _violation: ViolationValue;

	/** Responsibilities: _issue-report fixture initialization_. **/
	public constructor(root: string, source_file = "src/sample.ts", source_available = true) {
		this._file_io = new InMemoryFileIO();
		if (source_available) {
			this._file_io.seed_files(new Map([[join(root, source_file), "export const answer = 42;\n"]]));
		}
		const workspace_root = join(root, ".ai-code-guard");
		this._documents = new TaskWorkspace(root, this._file_io);
		this._batch = new TaskBatchReplacement(
			this._documents,
			workspace_root,
			join(workspace_root, "rules"),
			this._file_io,
		);
		const documentation = new TaskRuleDocumentation(root, this._file_io);
		const rule_document = documentation.source_path("parse-error[typescript]");
		this._file_io.create_directory(dirname(rule_document));
		this._file_io.file(rule_document).write_text("# Parse error\n");
		this._violation = new ViolationValue({
			file: source_file,
			line: 1,
			message: "source cannot be parsed",
			hint: "fix the syntax",
			rule_id: "parse-error",
			priority: 5,
		});
	}
}
