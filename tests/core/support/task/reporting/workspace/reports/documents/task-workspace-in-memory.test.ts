import { dirname, join } from "node:path";
import { describe, expect, test } from "@jest/globals";
import { TaskReporting } from "src/core/support/task/reporting/workspace/reports/documents/task_reporting";
import { TaskWorkspace } from "src/core/task_workspace";
import { InMemoryFileIO } from "tests/bridge/ts/core/cache/in_memory_file_io";
import { TaskReportingMemoryFixture } from "tests/bridge/ts/core/support/task-reporting-memory-fixture";

describe("task workspace in-memory IOContract", () => {
	test("publishes formatted task documents through the workspace reporting owner", () => {
		const fixture_factory = new TaskReportingMemoryFixture();
		const fixture = fixture_factory.create();
		const reporting = new TaskReporting(fixture._root, {
			file_io: fixture._file_io,
			documentation: fixture._documentation,
		});
		const output = reporting.format([], { batch_size: 10, policy: "top-category", skip_review: true });
		expect({
			output_has_workspace_path: output.includes(".ai-code-guard/report.md"),
			report_exists: fixture.task_text("report.md").length > 0,
		}).toEqual({ output_has_workspace_path: true, report_exists: true });
	});

	test("writes documents and prepares review directories in virtual storage", () => {
		const root = "/virtual/task-workspace";
		const file_io = new InMemoryFileIO();
		file_io.create_directory(root);
		const workspace = new TaskWorkspace(root, file_io);
		workspace.write_document("issues", "# Issues");
		workspace.write_performance("# Performance");
		workspace.prepare_review();

		const workspace_root = join(root, ".ai-code-guard");
		expect({
			issues: file_io.file(join(workspace_root, "issues.md")).file_text(),
			performance: file_io.file(join(workspace_root, "performance.md")).file_text(),
			review_directory: file_io.file(join(workspace_root, "review")).path_exists(),
			legacy_prompt: file_io.file(join(workspace_root, "architecture-review-prompt.md")).path_exists(),
		}).toEqual({
			issues: "# Issues\n",
			performance: "# Performance\n",
			review_directory: true,
			legacy_prompt: false,
		});
	});

	test("clears stale task output while retaining the review directory", () => {
		const root = "/virtual/task-workspace-clear";
		const file_io = new InMemoryFileIO();
		file_io.create_directory(root);
		const workspace = new TaskWorkspace(root, file_io);
		workspace.write_document("issues", "stale issues");
		const stale_rule = workspace.rule_document_path("parse-error");
		file_io.create_directory(dirname(stale_rule));
		file_io.file(stale_rule).write_text("stale rule");
		workspace.clear_batch();

		const workspace_root = join(root, ".ai-code-guard");
		expect({
			issues: file_io.file(join(workspace_root, "issues.md")).path_exists(),
			rules: file_io.file(join(workspace_root, "rules")).path_exists(),
			stale_rule: file_io.file(stale_rule).path_exists(),
			rule_entries: file_io.list_files(join(workspace_root, "rules")),
			review: file_io.file(join(workspace_root, "review")).path_exists(),
		}).toEqual({ issues: false, rules: true, stale_rule: false, rule_entries: [], review: true });
	});
});
