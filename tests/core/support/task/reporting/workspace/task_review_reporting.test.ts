import { join } from "node:path";
import { describe, expect, test } from "@jest/globals";
import { TaskReporting } from "src/core/support/task/reporting/workspace/task_reporting";
import { ViolationValue } from "src/model/violation_value";
import type { ViolationContract } from "src/reporting_protocols";
import { TaskReportingMemoryFixture } from "tests/bridge/ts/core/support/task-reporting-memory-fixture";

describe("coding-lint architecture review reporting", () => {
	test("does not inspect review markdown while code problems exist", () => {
		const fixture_factory = new TaskReportingMemoryFixture();
		const fixture = fixture_factory.create({ "a.ts": "const value = 1;\n" });
		const reporting = new TaskReporting(fixture._root, {
			file_io: fixture._file_io,
			documentation: fixture._documentation,
		});
		const review_root = fixture.task_path("review");
		fixture._file_io.create_directory(review_root);
		fixture._file_io.file(join(review_root, "unfinished.md")).write_text("unfinished review\n");
		const violation: ViolationContract = new ViolationValue({
			file: "a.ts",
			line: 1,
			message: "parse-error message",
			hint: "parse-error hint",
			rule_id: "parse-error",
			priority: 3,
		});
		const output = reporting.format([violation], {
			batch_size: 10,
			policy: "top-category",
			skip_review: false,
		});
		const result = { output, issues: fixture.task_text("issues.md") };
		expect({
			review_request: result.output.includes("ZERO LINT ISSUES IS NOT COMPLETION:"),
			code_problem: result.issues.includes("Problem: parse-error message"),
		}).toEqual({ review_request: false, code_problem: true });
	});

	test("prints only total counts when there are no issues", () => {
		const fixture_factory = new TaskReportingMemoryFixture();
		const fixture = fixture_factory.create();
		const reporting = new TaskReporting(fixture._root, {
			file_io: fixture._file_io,
			documentation: fixture._documentation,
		});
		const output = reporting.format([], { batch_size: 10, policy: "top-category", skip_review: false });
		expect({
			counts: output.includes("Total issues: 0.\nTotal files: 0."),
			priority_summary: output.includes("1: 0, 2: 0, 3: 0."),
		}).toEqual({ counts: true, priority_summary: false });
	});

	test("keeps open review findings in results when review is skipped", () => {
		const fixture_factory = new TaskReportingMemoryFixture();
		const fixture = fixture_factory.create({ "a.ts": "const value = 1;\n" });
		const reporting = new TaskReporting(fixture._root, {
			file_io: fixture._file_io,
			documentation: fixture._documentation,
		});
		const review_root = fixture.task_path("review");
		fixture._file_io.create_directory(review_root);
		fixture._file_io
			.file(join(review_root, "review-boundaries-open.md"))
			.write_text("# Open review\n\nConfirmed architectural defect.\n");
		const output = reporting.format([], { batch_size: 10, policy: "all", skip_review: true });
		expect(output).toContain("Confirmed architectural defect.");
	});
});
