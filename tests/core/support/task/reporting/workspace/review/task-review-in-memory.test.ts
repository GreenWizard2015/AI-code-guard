import { join } from "node:path";
import { describe, expect, test } from "@jest/globals";
import { TaskReview } from "src/core/support/task/reporting/workspace/review/task_review";
import { ResolvedReviewArchive } from "src/core/support/task/resolved_review_archive";
import { REVIEW_COMPLETION_TEXT, REVIEW_SOURCE_IDENTITY_PREFIX } from "src/core/support/task/review-agent/constants";
import { ReviewStateIdentity } from "src/core/support/task/review-agent/review_state_identity";
import { InMemoryFileIO } from "tests/bridge/ts/core/cache/in_memory_file_io";

describe("task review in-memory IOContract", () => {
	test("archives resolved findings and lists only open findings", () => {
		const root = "/virtual/task-review-findings";
		const review_root = join(root, ".ai-code-guard", "review");
		const file_io = new InMemoryFileIO();
		file_io.create_directory(review_root);
		file_io.file(join(review_root, "open.md")).write_text("Confirmed defect\nStatus: Open\n");
		file_io.file(join(review_root, "resolved.md")).write_text("Status: Resolved\n");
		const review = new TaskReview(root, file_io);
		const archive = new ResolvedReviewArchive(root, file_io);
		archive.archive_resolved_reviews();

		expect({
			active_files: review.files(),
			archived_file: file_io.file(join(root, ".ai-code-guard", "resolved-review", "resolved.md")).path_exists(),
			old_resolved_file: file_io.file(join(review_root, "resolved.md")).path_exists(),
		}).toEqual({
			active_files: [join(review_root, "open.md")],
			archived_file: true,
			old_resolved_file: false,
		});
	});

	test("replaces a stale archived finding with its resolved active copy", () => {
		const root = "/virtual/task-review-archive-collision";
		const state_root = join(root, ".ai-code-guard");
		const review_root = join(state_root, "review");
		const resolved_root = join(state_root, "resolved-review");
		const source_file = join(review_root, "finding.md");
		const archived_file = join(resolved_root, "finding.md");
		const file_io = new InMemoryFileIO();
		file_io.create_directory(review_root);
		file_io.create_directory(resolved_root);
		file_io.file(source_file).write_text("# Updated finding\nStatus: Resolved\n");
		file_io.file(archived_file).write_text("# Stale finding\nStatus: Resolved\n");

		const archive = new ResolvedReviewArchive(root, file_io);
		archive.archive_resolved_reviews();

		expect({
			source_exists: file_io.file(source_file).path_exists(),
			archived_text: file_io.file(archived_file).file_text(),
		}).toEqual({
			source_exists: false,
			archived_text: "# Updated finding\nStatus: Resolved\n",
		});
	});

	test("does not treat a resolved marker in fenced evidence as finding status", () => {
		const root = "/virtual/task-review-fenced-status";
		const review_root = join(root, ".ai-code-guard", "review");
		const file_io = new InMemoryFileIO();
		file_io.create_directory(review_root);
		const finding = join(review_root, "finding.md");
		file_io
			.file(finding)
			.write_text("# Finding\nSeverity: High\nStatus: Open\n\n## Evidence\n```text\nStatus: Resolved\n```\n");
		const review = new TaskReview(root, file_io);
		const archive = new ResolvedReviewArchive(root, file_io);
		archive.archive_resolved_reviews();

		expect({
			active_files: review.files(),
			archived: file_io.file(join(root, ".ai-code-guard", "resolved-review", "finding.md")).path_exists(),
		}).toEqual({ active_files: [finding], archived: false });
	});

	test.each([
		["conflicting", "Status: Open\nStatus: Resolved\n"],
		["repeated resolved", "Status: Resolved\nStatus: Resolved\n"],
		["unknown", "Status: Maybe\n"],
	])("keeps %s status actionable and out of the archive", (_description, status) => {
		const root = "/virtual/task-review-invalid-status";
		const review_root = join(root, ".ai-code-guard", "review");
		const file_io = new InMemoryFileIO();
		file_io.create_directory(review_root);
		const finding = join(review_root, "finding.md");
		file_io.file(finding).write_text(`# Finding\nSeverity: Major\n${status}Task: Keep the invariant.\n`);
		const review = new TaskReview(root, file_io);
		const archive = new ResolvedReviewArchive(root, file_io);

		archive.archive_resolved_reviews();

		expect({
			active_files: review.files(),
			still_in_review: file_io.file(finding).path_exists(),
			archived: file_io.file(join(root, ".ai-code-guard", "resolved-review", "finding.md")).path_exists(),
		}).toEqual({ active_files: [finding], still_in_review: true, archived: false });
	});

	test("does not report completion while a finding has an ambiguous status", () => {
		const root = "/virtual/task-review-invalid-completion";
		const review_root = join(root, ".ai-code-guard", "review");
		const file_io = new InMemoryFileIO();
		file_io.create_directory(review_root);
		file_io.file(join(review_root, "finding.md")).write_text("# Finding\nStatus: Resolved\nStatus: Open\n");
		const review_state_identity = new ReviewStateIdentity(root, file_io);
		const task_review = new TaskReview(root, file_io);
		file_io
			.file(join(review_root, "review-complete.md"))
			.write_text(`${REVIEW_COMPLETION_TEXT}\n${REVIEW_SOURCE_IDENTITY_PREFIX}${review_state_identity.value()}\n`);

		expect(task_review.completed()).toBe(false);
	});

	test("accepts completion only when source identity matches and no finding is open", () => {
		const root = "/virtual/task-review-completion";
		const review_root = join(root, ".ai-code-guard", "review");
		const file_io = new InMemoryFileIO();
		file_io.seed_files(new Map([[join(root, "source.ts"), "const value = 1;\n"]]));
		file_io.create_directory(review_root);
		const identity = new ReviewStateIdentity(root, file_io);
		const completion = join(review_root, "review-complete.md");
		file_io
			.file(completion)
			.write_text(`${REVIEW_COMPLETION_TEXT}\n${REVIEW_SOURCE_IDENTITY_PREFIX}${identity.value()}\n`);
		const review = new TaskReview(root, file_io);
		const complete_before_source_change = review.completed();
		file_io.file(join(root, "source.ts")).write_text("const value = 2;\n");

		expect({ complete_before_source_change, complete_after_source_change: review.completed() }).toEqual({
			complete_before_source_change: true,
			complete_after_source_change: false,
		});
	});
});
