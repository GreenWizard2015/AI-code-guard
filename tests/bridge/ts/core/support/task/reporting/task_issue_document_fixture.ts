import { dirname, join } from "node:path";
import { InMemoryFileIO } from "tests/bridge/ts/core/cache/in_memory_file_io";
import { TaskRuleDocumentCatalog } from "src/core/support/task/reporting/task_rule_document_catalog";
import { TaskWorkspace } from "src/core/support/task/task_workspace";
import type { ReportViolation } from "src/types";

/** Responsibilities: _virtual issue-report state_, _source-backed violation creation_. **/
export class TaskIssueDocumentFixture {
	public readonly file_io: InMemoryFileIO;
	public readonly workspace: TaskWorkspace;
	public readonly violation: ReportViolation;

	/** Responsibilities: _issue-report fixture initialization_. **/
	public constructor(root: string, source_file = "src/sample.ts", source_available = true) {
		this.file_io = new InMemoryFileIO();
		if (source_available) {
			this.file_io.seed_files(new Map([[join(root, source_file), "export const answer = 42;\n"]]));
		}
		this.workspace = new TaskWorkspace(root, this.file_io);
		const catalog = new TaskRuleDocumentCatalog(root);
		const rule_document = catalog.source_path("parse-error[typescript]");
		this.file_io.directory_operations.create_directory(dirname(rule_document));
		this.file_io.file_content.write_text(rule_document, "# Parse error\n");
		this.violation = {
			file: source_file,
			line: 1,
			message: "source cannot be parsed",
			hint: "fix the syntax",
			rule_id: "parse-error",
			priority: 5,
		};
	}
}
