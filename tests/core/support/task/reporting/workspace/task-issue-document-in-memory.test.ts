import { dirname } from "node:path";
import { describe, expect, test } from "@jest/globals";
import { TaskRuleDocumentation } from "src/core/support/task/reporting/task_rule_documentation";
import { TaskIssueDocument } from "src/core/support/task/reporting/workspace/task_issue_document";
import { ViolationValue } from "src/model/violation_value";
import { TaskIssueDocumentFixture } from "tests/bridge/ts/core/support/task/reporting/task_issue_document_fixture";

describe("task issue document in-memory IOContract", () => {
	test("renders source context and publishes its rule document virtually", () => {
		const root = "/virtual/task-issue-document";
		const fixture = new TaskIssueDocumentFixture(root);
		const document = new TaskIssueDocument(
			root,
			fixture._documents,
			fixture._batch,
			new TaskRuleDocumentation(root, fixture._file_io),
			fixture._file_io,
		);
		document.write([fixture._violation], [], new Map([["report", "# Report\n"]]));
		const issue_path = fixture._documents.path_for_document("issues");
		expect({
			issue: fixture._file_io.file(issue_path).file_text(),
			published_rule: fixture._file_io
				.file(fixture._documents.rule_document_path("parse-error[typescript]"))
				.file_text(),
			staging_directories: fixture._file_io
				.list_entries(dirname(root))
				.filter((entry) => entry.name.startsWith("ai-code-guard-task-")),
		}).toEqual({
			issue: expect.stringContaining("- Line 1: export const answer = 42;"),
			published_rule: "# Parse error\n",
			staging_directories: [],
		});
	});

	test("renders an explicit unavailable-source result after the source disappears", () => {
		const root = "/virtual/task-issue-document-missing-source";
		const fixture = new TaskIssueDocumentFixture(root, "src/removed.ts", false);
		const document = new TaskIssueDocument(
			root,
			fixture._documents,
			fixture._batch,
			new TaskRuleDocumentation(root, fixture._file_io),
			fixture._file_io,
		);
		document.write(
			[
				new ViolationValue({
					file: fixture._violation.file(),
					line: fixture._violation.line(),
					message: "source disappeared before reporting",
					hint: fixture._violation.hint(),
					rule_id: fixture._violation.rule_id(),
					priority: fixture._violation.priority(),
				}),
			],
			[],
			new Map(),
		);

		expect(fixture._file_io.file(fixture._documents.path_for_document("issues")).file_text()).toContain(
			"- Line 1: (source unavailable)",
		);
	});

	test("includes unresolved review paths after lint sections", () => {
		const root = "/virtual/task-issue-document-review";
		const fixture = new TaskIssueDocumentFixture(root);
		const document = new TaskIssueDocument(
			root,
			fixture._documents,
			fixture._batch,
			new TaskRuleDocumentation(root, fixture._file_io),
			fixture._file_io,
		);
		document.write([fixture._violation], [".ai-code-guard/review/open-finding.md"], new Map());
		const issue_text = fixture._file_io.file(fixture._documents.path_for_document("issues")).file_text();

		expect(issue_text).toContain("# Unresolved architecture review files\n- .ai-code-guard/review/open-finding.md");
	});
});
