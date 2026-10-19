import { dirname } from "node:path";
import { describe, expect, test } from "@jest/globals";
import { TaskIssueDocumentFixture } from "tests/bridge/ts/core/support/task/reporting/task_issue_document_fixture";
import { TaskIssueDocument } from "src/core/support/task/reporting/task_issue_document";
import { TaskRuleDocumentation } from "src/core/support/task/reporting/task_rule_documentation";

describe("task issue document in-memory IO", () => {
	test("renders source context and publishes its rule document virtually", () => {
		const root = "/virtual/task-issue-document";
		const fixture = new TaskIssueDocumentFixture(root);
		const document = new TaskIssueDocument(
			root,
			fixture.workspace.documents,
			fixture.workspace.batch,
			new TaskRuleDocumentation(root, fixture.file_io),
			fixture.file_io,
		);
		document.write([fixture.violation], [], new Map([["report", "# Report\n"]]));
		const issue_path = fixture.workspace.documents.path_for_document("issues");
		expect({
			issue: fixture.file_io.file_content.file_text(issue_path),
			published_rule: fixture.file_io.file_content.file_text(
				fixture.workspace.documents.rule_document_path("parse-error[typescript]"),
			),
			staging_directories: fixture.file_io.directory_entries
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
			fixture.workspace.documents,
			fixture.workspace.batch,
			new TaskRuleDocumentation(root, fixture.file_io),
			fixture.file_io,
		);
		document.write([{ ...fixture.violation, message: "source disappeared before reporting" }], [], new Map());

		expect(fixture.file_io.file_content.file_text(fixture.workspace.documents.path_for_document("issues"))).toContain(
			"- Line 1: (source unavailable)",
		);
	});
});
