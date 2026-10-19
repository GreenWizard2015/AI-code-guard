import "src/core/lint_project_context_creator";
import { describe, expect, test } from "@jest/globals";
import { ReviewAgentFiles } from "src/core/support/task/review-agent/review_agent_files";
import { InMemoryFileIO } from "tests/bridge/ts/core/cache/in_memory_file_io";

describe("review agent files with in-memory IO", () => {
	test("lists only unresolved matching findings and reports their size", () => {
		const root = "/virtual/review";
		const file_io = new InMemoryFileIO();
		file_io.seed_files(
			new Map([
				[`${root}/review-boundaries-open.md`, Array.from({ length: 20 }, (_, index) => `line ${index}`).join("\n")],
				[`${root}/review-boundaries-resolved.md`, "Finding\nStatus: Resolved\n"],
				[`${root}/review-tests-open.md`, "Other stage\n"],
			]),
		);
		const files = new ReviewAgentFiles(root, file_io, "review-boundaries-");

		expect(files.review_notes()).toEqual([`${root}/review-boundaries-open.md`]);
		expect(files.size_feedback()).toEqual([]);
	});

	test("resets status documents and records completion through the IO contract", () => {
		const root = "/virtual/review";
		const failure = `${root}/agent-start-failed.md`;
		const completion = `${root}/review-complete.md`;
		const file_io = new InMemoryFileIO();
		file_io.seed_files(new Map([[failure, "old failure"]]));
		const files = new ReviewAgentFiles(root, file_io);

		files.reset();
		files.write_failure("provider unavailable");
		files.write_completion("source-hash");

		expect({
			failure_exists: file_io.file_paths.path_exists(failure),
			failure_text: file_io.file_content.file_text(failure),
			completion_text: file_io.file_content.file_text(completion),
		}).toEqual({
			failure_exists: true,
			failure_text: expect.stringContaining("provider unavailable"),
			completion_text: expect.stringContaining("source-hash"),
		});
	});
});
