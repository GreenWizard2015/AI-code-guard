import { join } from "node:path";
import { describe, expect, test } from "@jest/globals";
import { InMemoryFileIO } from "tests/bridge/ts/core/cache/in_memory_file_io";
import { TaskReview } from "src/core/support/task/task_review";
import { ResolvedReviewArchive } from "src/core/support/task/resolved_review_archive";
import { REVIEW_COMPLETION_TEXT, REVIEW_SOURCE_IDENTITY_PREFIX } from "src/core/support/task/review-agent/constants";
import { ReviewStateIdentity } from "src/core/support/task/review-agent/review_state_identity";

describe("task review in-memory IO", () => {
	test("archives resolved findings and lists only open findings", () => {
		const root = "/virtual/task-review-findings";
		const review_root = join(root, ".ai-code-guard", "review");
		const file_io = new InMemoryFileIO();
		file_io.directory_operations.create_directory(review_root);
		file_io.file_content.write_text(join(review_root, "open.md"), "Confirmed defect\nStatus: Open\n");
		file_io.file_content.write_text(join(review_root, "resolved.md"), "Status: Resolved\n");
		const review = new TaskReview(root, file_io);
		const archive = new ResolvedReviewArchive(root, file_io);
		archive.archive_resolved_reviews();

		expect({
			active_files: review.files(),
			archived_file: file_io.file_paths.path_exists(join(root, ".ai-code-guard", "resolved-review", "resolved.md")),
			old_resolved_file: file_io.file_paths.path_exists(join(review_root, "resolved.md")),
		}).toEqual({
			active_files: [join(review_root, "open.md")],
			archived_file: true,
			old_resolved_file: false,
		});
	});

	test("accepts completion only when source identity matches and no finding is open", () => {
		const root = "/virtual/task-review-completion";
		const review_root = join(root, ".ai-code-guard", "review");
		const file_io = new InMemoryFileIO();
		file_io.seed_files(new Map([[join(root, "source.ts"), "const value = 1;\n"]]));
		file_io.directory_operations.create_directory(review_root);
		const identity = new ReviewStateIdentity(root, file_io);
		const completion = join(review_root, "review-complete.md");
		file_io.file_content.write_text(
			completion,
			`${REVIEW_COMPLETION_TEXT}\n${REVIEW_SOURCE_IDENTITY_PREFIX}${identity.value()}\n`,
		);
		const review = new TaskReview(root, file_io);
		const complete_before_source_change = review.completed();
		file_io.file_content.write_text(join(root, "source.ts"), "const value = 2;\n");

		expect({ complete_before_source_change, complete_after_source_change: review.completed() }).toEqual({
			complete_before_source_change: true,
			complete_after_source_change: false,
		});
	});
});
