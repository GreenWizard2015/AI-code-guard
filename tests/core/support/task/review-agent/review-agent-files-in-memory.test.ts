import "src/core/lint_project_context_creator";
import { describe, expect, test } from "@jest/globals";
import { ReviewAgentFiles } from "src/core/support/task/review-agent/review_agent_files";
import { InMemoryFileIO } from "tests/bridge/ts/core/cache/in_memory_file_io";

describe("review agent files with in-memory IOContract", () => {
	test("lists only unresolved matching findings and reports their size", () => {
		const root = "/virtual/review";
		const file_io = new InMemoryFileIO();
		file_io.seed_files(
			new Map([
				[`${root}/review-boundaries-open.md`, Array.from({ length: 20 }, (_, index) => `line ${index}`).join("\n")],
				[`${root}/review-boundaries-long.md`, Array.from({ length: 31 }, (_, index) => `line ${index}`).join("\n")],
				[`${root}/review-boundaries-resolved.md`, "Finding\nStatus: Resolved\n"],
				[`${root}/review-tests-open.md`, "Other stage\n"],
			]),
		);
		const files = new ReviewAgentFiles(root, file_io, "review-boundaries-", Number.NEGATIVE_INFINITY);

		expect(files.review_notes()).toEqual([`${root}/review-boundaries-long.md`, `${root}/review-boundaries-open.md`]);
		expect(files.size_feedback()).toEqual([
			`Review file ${root}/review-boundaries-long.md has 31 lines and is too long. Split it into focused review files, each no longer than 30 lines. Keep every confirmed finding, then mark the original file Status: Resolved.`,
		]);
	});

	test("keeps malformed status findings in the active inventory", () => {
		const root = "/virtual/review-status-inventory";
		const file_io = new InMemoryFileIO();
		file_io.seed_files(
			new Map([
				[`${root}/review-boundaries-conflict.md`, "Finding\nStatus: Open\nStatus: Resolved\n"],
				[`${root}/review-boundaries-repeated.md`, "Finding\nStatus: Resolved\nStatus: Resolved\n"],
				[`${root}/review-boundaries-unknown.md`, "Finding\nStatus: Maybe\n"],
				[`${root}/review-boundaries-resolved.md`, "Finding\nStatus: Resolved\n"],
			]),
		);
		const files = new ReviewAgentFiles(root, file_io, "review-boundaries-", Number.NEGATIVE_INFINITY);

		expect(files.review_notes()).toEqual([
			`${root}/review-boundaries-conflict.md`,
			`${root}/review-boundaries-repeated.md`,
			`${root}/review-boundaries-unknown.md`,
		]);
	});

	test("keeps older findings readable but excludes them from current-run counts", () => {
		const root = "/virtual/review-start-boundary";
		const old_file = `${root}/review-boundaries-old.md`;
		const current_file = `${root}/review-boundaries-current.md`;
		const file_io = new InMemoryFileIO();
		file_io.seed_files(new Map([[old_file, "Old finding\nStatus: Open\n"]]));
		const review_start_ms = file_io.file(old_file).metadata().mtime_ms;
		file_io.file(current_file).write_text("Current finding\nStatus: Open\n");
		const files = new ReviewAgentFiles(root, file_io, "review-boundaries-", review_start_ms);

		expect({ readable_findings: files.review_notes(), current_findings: files.current_review_notes() }).toEqual({
			readable_findings: [current_file, old_file],
			current_findings: [current_file],
		});
	});

	test("resets status documents and records completion through the IOContract contract", () => {
		const root = "/virtual/review";
		const failure = `${root}/agent-start-failed.md`;
		const completion = `${root}/review-complete.md`;
		const finding = `${root}/review-boundaries-existing.md`;
		const file_io = new InMemoryFileIO();
		file_io.seed_files(
			new Map([
				[failure, "old failure"],
				[completion, "old completion"],
				[finding, "Finding\nStatus: Open\n"],
			]),
		);
		const files = new ReviewAgentFiles(root, file_io, "", Number.NEGATIVE_INFINITY);

		files.reset();
		const reset_state = {
			failure_exists: file_io.file(failure).path_exists(),
			completion_exists: file_io.file(completion).path_exists(),
			finding: file_io.file(finding).file_text(),
		};
		files.write_failure("provider unavailable");
		files.write_completion("source-hash");

		expect(reset_state).toEqual({
			failure_exists: false,
			completion_exists: false,
			finding: "Finding\nStatus: Open\n",
		});
		expect({
			failure_exists: file_io.file(failure).path_exists(),
			failure_text: file_io.file(failure).file_text(),
			completion_text: file_io.file(completion).file_text(),
		}).toEqual({
			failure_exists: true,
			failure_text: expect.stringContaining("provider unavailable"),
			completion_text: expect.stringContaining("source-hash"),
		});
	});
});
