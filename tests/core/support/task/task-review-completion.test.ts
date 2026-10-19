import { join } from "node:path";
import { describe, expect, test } from "@jest/globals";
import { TaskReview } from "src/core/support/task/task_review";
import { TaskReporting } from "src/core/support/task_reporting";
import { ReviewStateIdentity } from "src/core/support/task/review-agent/review_state_identity";
import {
	REVIEW_COMPLETION_TEXT,
	REVIEW_FAILURE_FILE,
	REVIEW_SOURCE_IDENTITY_PREFIX,
} from "src/core/support/task/review-agent/constants";
import { TaskReportingMemoryFixture } from "tests/bridge/ts/core/support/task-reporting-memory-fixture";

describe("coding-lint review completion reporting", () => {
	test("keeps review instructions out of the console status", () => {
		const fixture_factory = new TaskReportingMemoryFixture();
		const fixture = fixture_factory.create();
		const reporting = new TaskReporting(fixture.root, {
			file_io: fixture.file_io,
			documentation: fixture.documentation,
		});
		const output = reporting.format([], { batch_size: 10, policy: "top-category", skip_review: false });
		const result = { output, report: fixture.task_text("report.md") };
		const instruction_path = result.output.includes("architecture-review-prompt.md");
		const review_path = result.output.includes(".ai-code-guard/review/*.md");
		const completion_code = result.output.includes("completion code");
		const instruction_hidden =
			!result.output.includes("## RuleContract philosophy") &&
			!result.output.includes("ZERO LINT ISSUES IS NOT COMPLETION:");
		expect({
			instruction_path,
			review_path,
			completion_code,
			instruction_hidden,
			report_path: result.output.includes("Report in file `") && result.output.includes("report.md`"),
			report: result.report.includes("| — | 0 | 0 |"),
		}).toEqual({
			instruction_path: false,
			review_path: true,
			completion_code: false,
			instruction_hidden: true,
			report_path: true,
			report: true,
		});
	});

	test("stops the review request when the linter completion document is present", () => {
		const fixture_factory = new TaskReportingMemoryFixture();
		const fixture = fixture_factory.create();
		const reporting = new TaskReporting(fixture.root, {
			file_io: fixture.file_io,
			documentation: fixture.documentation,
		});
		const review_root = fixture.task_path("review");
		fixture.file_io.directory_operations.create_directory(review_root);
		const identity = new ReviewStateIdentity(fixture.root, fixture.file_io);
		fixture.file_io.file_content.write_text(
			join(review_root, "review-complete.md"),
			`${REVIEW_COMPLETION_TEXT}\n${REVIEW_SOURCE_IDENTITY_PREFIX}${identity.value()}\n`,
		);
		const review = new TaskReview(fixture.root, fixture.file_io);
		const completed = review.completed();
		const output = reporting.format([], { batch_size: 10, policy: "top-category", skip_review: false });
		const result = { completed, output };
		expect({
			verified: result.completed,
			request_stopped: !result.output.includes("ZERO LINT ISSUES IS NOT COMPLETION:"),
			no_markdown_check: !result.output.includes("too short"),
		}).toEqual({ verified: true, request_stopped: true, no_markdown_check: true });
	});

	test("failure documents invalidate completion markers", () => {
		const fixture_factory = new TaskReportingMemoryFixture();
		const fixture = fixture_factory.create();
		const review_root = fixture.task_path("review");
		fixture.file_io.directory_operations.create_directory(review_root);
		const identity = new ReviewStateIdentity(fixture.root, fixture.file_io);
		fixture.file_io.file_content.write_text(
			join(review_root, "review-complete.md"),
			[REVIEW_COMPLETION_TEXT, `${REVIEW_SOURCE_IDENTITY_PREFIX}${identity.value()}`, ""].join("\n"),
		);
		const review = new TaskReview(fixture.root, fixture.file_io);
		fixture.file_io.file_content.write_text(join(review_root, REVIEW_FAILURE_FILE), "agent start failed\n");

		expect(review.completed()).toBe(false);
	});

	test("restores completion after a failure document is removed", () => {
		const fixture_factory = new TaskReportingMemoryFixture();
		const fixture = fixture_factory.create();
		const review_root = fixture.task_path("review");
		fixture.file_io.directory_operations.create_directory(review_root);
		const identity = new ReviewStateIdentity(fixture.root, fixture.file_io);
		fixture.file_io.file_content.write_text(
			join(review_root, "review-complete.md"),
			`${REVIEW_COMPLETION_TEXT}\n${REVIEW_SOURCE_IDENTITY_PREFIX}${identity.value()}\n`,
		);
		const review = new TaskReview(fixture.root, fixture.file_io);
		fixture.file_io.file_content.write_text(join(review_root, REVIEW_FAILURE_FILE), "agent start failed\n");
		fixture.file_io.file_operations.remove_file(join(review_root, REVIEW_FAILURE_FILE));

		expect(review.completed()).toBe(true);
	});

	test("does not certify a valid marker while a finding is open", () => {
		const fixture_factory = new TaskReportingMemoryFixture();
		const fixture = fixture_factory.create();
		const review_root = fixture.task_path("review");
		fixture.file_io.directory_operations.create_directory(review_root);
		const identity = new ReviewStateIdentity(fixture.root, fixture.file_io);
		fixture.file_io.file_content.write_text(
			join(review_root, "review-complete.md"),
			`${REVIEW_COMPLETION_TEXT}\n${REVIEW_SOURCE_IDENTITY_PREFIX}${identity.value()}\n`,
		);
		fixture.file_io.file_content.write_text(
			join(review_root, "finding.md"),
			"Confirmed architectural defect\nStatus: Open\n",
		);
		const review = new TaskReview(fixture.root, fixture.file_io);

		expect(review.completed()).toBe(false);
	});

	test("certifies a valid marker when every finding is resolved", () => {
		const fixture_factory = new TaskReportingMemoryFixture();
		const fixture = fixture_factory.create();
		const review_root = fixture.task_path("review");
		fixture.file_io.directory_operations.create_directory(review_root);
		const identity = new ReviewStateIdentity(fixture.root, fixture.file_io);
		fixture.file_io.file_content.write_text(
			join(review_root, "review-complete.md"),
			`${REVIEW_COMPLETION_TEXT}\n${REVIEW_SOURCE_IDENTITY_PREFIX}${identity.value()}\n`,
		);
		fixture.file_io.file_content.write_text(
			join(review_root, "finding.md"),
			"Confirmed architectural defect\nStatus: Resolved\n",
		);
		const review = new TaskReview(fixture.root, fixture.file_io);

		expect(review.completed()).toBe(true);
	});

	test("requests a new review after the source state changes", () => {
		const fixture_factory = new TaskReportingMemoryFixture();
		const fixture = fixture_factory.create({ "a.ts": "const value = 1;\n" });
		const reporting = new TaskReporting(fixture.root, {
			file_io: fixture.file_io,
			documentation: fixture.documentation,
		});
		const review_root = fixture.task_path("review");
		fixture.file_io.directory_operations.create_directory(review_root);
		const identity = new ReviewStateIdentity(fixture.root, fixture.file_io);
		fixture.file_io.file_content.write_text(
			join(review_root, "review-complete.md"),
			`${REVIEW_COMPLETION_TEXT}\n${REVIEW_SOURCE_IDENTITY_PREFIX}${identity.value()}\n`,
		);
		fixture.file_io.file_content.write_text(join(fixture.root, "a.ts"), "const value = 2;\n");
		const result = reporting.review_requested([]);
		expect(result).toBe(true);
	});

	test("requests details for short review notes", () => {
		const fixture_factory = new TaskReportingMemoryFixture();
		const fixture = fixture_factory.create();
		const reporting = new TaskReporting(fixture.root, {
			file_io: fixture.file_io,
			documentation: fixture.documentation,
		});
		const review_root = fixture.task_path("review");
		fixture.file_io.directory_operations.create_directory(review_root);
		fixture.file_io.file_content.write_text(join(review_root, "short.md"), "too short\n");
		fixture.file_io.file_content.write_text(
			join(review_root, "problem.md"),
			`${Array.from({ length: 20 }, (_, index) => `line ${index}`).join("\n")}\n`,
		);
		const output = reporting.format([], { batch_size: 10, policy: "top-category", skip_review: false });
		const result = { output, short_file_exists: fixture.file_io.file_paths.path_exists(join(review_root, "short.md")) };
		expect({
			output: ["too short", "Add concrete architectural details", "Total issues: 2."].every((value) =>
				result.output.includes(value),
			),
			short_file_exists: result.short_file_exists,
		}).toEqual({ output: true, short_file_exists: true });
	});

	test("archives resolved review files while keeping them out of active findings", () => {
		const fixture_factory = new TaskReportingMemoryFixture();
		const fixture = fixture_factory.create();
		const reporting = new TaskReporting(fixture.root, {
			file_io: fixture.file_io,
			documentation: fixture.documentation,
		});
		const review_root = fixture.task_path("review");
		fixture.file_io.directory_operations.create_directory(review_root);
		const resolved_file = join(review_root, "resolved.md");
		fixture.file_io.file_content.write_text(resolved_file, "Status: Resolved\n");
		const review = new TaskReview(fixture.root, fixture.file_io);
		const active_files = review.files();
		reporting.format([], { batch_size: 10, policy: "top-category", skip_review: false });
		const archived_file = fixture.task_path(join("resolved-review", "resolved.md"));
		const result = {
			archived: fixture.file_io.file_paths.path_exists(archived_file),
			old_location: fixture.file_io.file_paths.path_exists(resolved_file),
			active_files,
		};
		expect(result).toEqual({ archived: true, old_location: false, active_files: [] });
	});
});
