import { join } from "node:path";
import { describe, expect, test } from "@jest/globals";
import { ReviewStateIdentity } from "src/core/support/task/review-agent/review_state_identity";
import { TaskReporting } from "src/core/support/task_reporting";
import type { ReportViolation } from "src/reporting_protocols";
import { TaskReportingMemoryFixture } from "tests/bridge/ts/core/support/task-reporting-memory-fixture";

describe("coding-lint architecture review reporting", () => {
	test("does not inspect review markdown while code problems exist", () => {
		const fixture_factory = new TaskReportingMemoryFixture();
		const fixture = fixture_factory.create({ "a.ts": "const value = 1;\n" });
		const reporting = new TaskReporting(fixture.root, {
			file_io: fixture.file_io,
			documentation: fixture.documentation,
		});
		const review_root = fixture.task_path("review");
		fixture.file_io.directory_operations.create_directory(review_root);
		fixture.file_io.file_content.write_text(join(review_root, "unfinished.md"), "unfinished review\n");
		const violation: ReportViolation = {
			file: "a.ts",
			line: 1,
			message: "parse-error message",
			hint: "parse-error hint",
			rule_id: "parse-error",
			priority: 3,
		};
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
		const reporting = new TaskReporting(fixture.root, {
			file_io: fixture.file_io,
			documentation: fixture.documentation,
		});
		const output = reporting.format([], { batch_size: 10, policy: "top-category", skip_review: false });
		expect({
			counts: output.includes("Total issues: 0.\nTotal files: 0."),
			priority_summary: output.includes("1: 0, 2: 0, 3: 0."),
		}).toEqual({ counts: true, priority_summary: false });
	});

	test("requests a failing exit status while architecture review is pending", () => {
		const fixture_factory = new TaskReportingMemoryFixture();
		const fixture = fixture_factory.create();
		const reporting = new TaskReporting(fixture.root, {
			file_io: fixture.file_io,
			documentation: fixture.documentation,
		});
		const pending = reporting.review_requested([]);
		const review_root = fixture.task_path("review");
		fixture.file_io.directory_operations.create_directory(review_root);
		const identity = new ReviewStateIdentity(fixture.root, fixture.file_io);
		fixture.file_io.file_content.write_text(
			join(review_root, "review-complete.md"),
			[
				"Architecture review completed. No confirmed major architectural defects remain.",
				`Source identity: ${identity.value()}`,
				"",
			].join("\n"),
		);
		const result = { pending, completed: reporting.review_requested([]) };
		expect(result).toEqual({ pending: true, completed: false });
	});
});
