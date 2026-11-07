import { join } from "node:path";
import { describe, expect, test } from "@jest/globals";
import { TaskReview } from "src/core/support/task/reporting/workspace/review/task_review";
import { TaskReporting } from "src/core/support/task/reporting/workspace/task_reporting";
import {
	REVIEW_COMPLETION_TEXT,
	REVIEW_FAILURE_FILE,
	REVIEW_SOURCE_IDENTITY_PREFIX,
} from "src/core/support/task/review-agent/constants";
import { ReviewStateIdentity } from "src/core/support/task/review-agent/review_state_identity";
import { TaskReportingMemoryFixture } from "tests/bridge/ts/core/support/task-reporting-memory-fixture";

describe("coding-lint review completion reporting", () => {
	test("keeps review instructions out of the console status", () => {
		const fixture_factory = new TaskReportingMemoryFixture();
		const fixture = fixture_factory.create();
		const reporting = new TaskReporting(fixture._root, {
			file_io: fixture._file_io,
			documentation: fixture._documentation,
		});
		const output = reporting.format([], { batch_size: 10, policy: "top-category", skip_review: false });
		const result = { output, report: fixture.task_text("report.md") };
		const instruction_path = result.output.includes("architecture-review-prompt.md");
		const review_path = result.output.includes(".ai-code-guard/review/*.md");
		const completion_code = result.output.includes("completion code");
		const instruction_hidden =
			!result.output.includes("## RuleContract philosophy") &&
			!result.output.includes("ZERO LINT ISSUES IS NOT COMPLETION:");
		const pending_request_present =
			result.output.includes("No review agent was selected.") && result.output.includes("--review-agent codex");
		expect({
			instruction_path,
			review_path,
			completion_code,
			instruction_hidden,
			pending_request_present,
			report_path: result.output.includes("Report in file `") && result.output.includes("report.md`"),
			report: result.report.includes("| — | 0 | 0 |"),
		}).toEqual({
			instruction_path: false,
			review_path: true,
			completion_code: false,
			instruction_hidden: true,
			pending_request_present: true,
			report_path: true,
			report: true,
		});
	});

	test("stops the review request when the linter completion document is present", () => {
		const fixture_factory = new TaskReportingMemoryFixture();
		const fixture = fixture_factory.create();
		const reporting = new TaskReporting(fixture._root, {
			file_io: fixture._file_io,
			documentation: fixture._documentation,
		});
		const review_root = fixture.task_path("review");
		fixture._file_io.create_directory(review_root);
		const identity = new ReviewStateIdentity(fixture._root, fixture._file_io);
		fixture._file_io
			.file(join(review_root, "review-complete.md"))
			.write_text(`${REVIEW_COMPLETION_TEXT}\n${REVIEW_SOURCE_IDENTITY_PREFIX}${identity.value()}\n`);
		const review = new TaskReview(fixture._root, fixture._file_io);
		const completed = review.completed();
		const output = reporting.format([], { batch_size: 10, policy: "top-category", skip_review: false });
		const result = { completed, output };
		expect({
			verified: result.completed,
			completion_reported: result.output.includes("Architecture review completed with no confirmed major defects."),
			request_stopped: !result.output.includes("Run `ai-code-guard --review-agent codex`"),
			no_markdown_check: !result.output.includes("too short"),
		}).toEqual({ verified: true, completion_reported: true, request_stopped: true, no_markdown_check: true });
	});

	test("failure documents invalidate completion markers", () => {
		const fixture_factory = new TaskReportingMemoryFixture();
		const fixture = fixture_factory.create();
		const review_root = fixture.task_path("review");
		fixture._file_io.create_directory(review_root);
		const identity = new ReviewStateIdentity(fixture._root, fixture._file_io);
		fixture._file_io
			.file(join(review_root, "review-complete.md"))
			.write_text([REVIEW_COMPLETION_TEXT, `${REVIEW_SOURCE_IDENTITY_PREFIX}${identity.value()}`, ""].join("\n"));
		const review = new TaskReview(fixture._root, fixture._file_io);
		fixture._file_io.file(join(review_root, REVIEW_FAILURE_FILE)).write_text("agent start failed\n");

		expect(review.completed()).toBe(false);
	});

	test("restores completion after a failure document is removed", () => {
		const fixture_factory = new TaskReportingMemoryFixture();
		const fixture = fixture_factory.create();
		const review_root = fixture.task_path("review");
		fixture._file_io.create_directory(review_root);
		const identity = new ReviewStateIdentity(fixture._root, fixture._file_io);
		fixture._file_io
			.file(join(review_root, "review-complete.md"))
			.write_text(`${REVIEW_COMPLETION_TEXT}\n${REVIEW_SOURCE_IDENTITY_PREFIX}${identity.value()}\n`);
		const review = new TaskReview(fixture._root, fixture._file_io);
		fixture._file_io.file(join(review_root, REVIEW_FAILURE_FILE)).write_text("agent start failed\n");
		fixture._file_io.file(join(review_root, REVIEW_FAILURE_FILE)).remove_file();

		expect(review.completed()).toBe(true);
	});

	test("does not certify a valid marker while a finding is open", () => {
		const fixture_factory = new TaskReportingMemoryFixture();
		const fixture = fixture_factory.create();
		const review_root = fixture.task_path("review");
		fixture._file_io.create_directory(review_root);
		const identity = new ReviewStateIdentity(fixture._root, fixture._file_io);
		fixture._file_io
			.file(join(review_root, "review-complete.md"))
			.write_text(`${REVIEW_COMPLETION_TEXT}\n${REVIEW_SOURCE_IDENTITY_PREFIX}${identity.value()}\n`);
		fixture._file_io.file(join(review_root, "finding.md")).write_text("Confirmed architectural defect\nStatus: Open\n");
		const review = new TaskReview(fixture._root, fixture._file_io);

		expect(review.completed()).toBe(false);
	});

	test("certifies a valid marker when every finding is resolved", () => {
		const fixture_factory = new TaskReportingMemoryFixture();
		const fixture = fixture_factory.create();
		const review_root = fixture.task_path("review");
		fixture._file_io.create_directory(review_root);
		const identity = new ReviewStateIdentity(fixture._root, fixture._file_io);
		fixture._file_io
			.file(join(review_root, "review-complete.md"))
			.write_text(`${REVIEW_COMPLETION_TEXT}\n${REVIEW_SOURCE_IDENTITY_PREFIX}${identity.value()}\n`);
		fixture._file_io
			.file(join(review_root, "finding.md"))
			.write_text("Confirmed architectural defect\nStatus: Resolved\n");
		const review = new TaskReview(fixture._root, fixture._file_io);

		expect(review.completed()).toBe(true);
	});

	test("invalidates completion after the source state changes", () => {
		const fixture_factory = new TaskReportingMemoryFixture();
		const fixture = fixture_factory.create({ "a.ts": "const value = 1;\n" });
		const reporting = new TaskReporting(fixture._root, {
			file_io: fixture._file_io,
			documentation: fixture._documentation,
		});
		const review_root = fixture.task_path("review");
		fixture._file_io.create_directory(review_root);
		const identity = new ReviewStateIdentity(fixture._root, fixture._file_io);
		fixture._file_io
			.file(join(review_root, "review-complete.md"))
			.write_text(`${REVIEW_COMPLETION_TEXT}\n${REVIEW_SOURCE_IDENTITY_PREFIX}${identity.value()}\n`);
		fixture._file_io.file(join(fixture._root, "a.ts")).write_text("const value = 2;\n");
		expect(reporting.review_status().completed).toBe(false);
	});

	test("requests details for short review notes", () => {
		const fixture_factory = new TaskReportingMemoryFixture();
		const fixture = fixture_factory.create();
		const reporting = new TaskReporting(fixture._root, {
			file_io: fixture._file_io,
			documentation: fixture._documentation,
		});
		const review_root = fixture.task_path("review");
		fixture._file_io.create_directory(review_root);
		fixture._file_io.file(join(review_root, "short.md")).write_text("too short\n");
		fixture._file_io
			.file(join(review_root, "problem.md"))
			.write_text(`${Array.from({ length: 20 }, (_, index) => `line ${index}`).join("\n")}\n`);
		const output = reporting.format([], { batch_size: 10, policy: "top-category", skip_review: false });
		const result = { output, short_file_exists: fixture._file_io.file(join(review_root, "short.md")).path_exists() };
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
		const reporting = new TaskReporting(fixture._root, {
			file_io: fixture._file_io,
			documentation: fixture._documentation,
		});
		const review_root = fixture.task_path("review");
		fixture._file_io.create_directory(review_root);
		const resolved_file = join(review_root, "resolved.md");
		fixture._file_io.file(resolved_file).write_text("Status: Resolved\n");
		const review = new TaskReview(fixture._root, fixture._file_io);
		const active_files = review.files();
		reporting.format([], { batch_size: 10, policy: "top-category", skip_review: false });
		const archived_file = fixture.task_path(join("resolved-review", "resolved.md"));
		const result = {
			archived: fixture._file_io.file(archived_file).path_exists(),
			old_location: fixture._file_io.file(resolved_file).path_exists(),
			active_files,
		};
		expect(result).toEqual({ archived: true, old_location: false, active_files: [] });
	});
});
