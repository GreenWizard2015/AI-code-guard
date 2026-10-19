import "src/core/lint_project_context_creator";
import { join } from "node:path";
import { describe, expect, test } from "@jest/globals";
import { InMemoryFileIO } from "tests/bridge/ts/core/cache/in_memory_file_io";
import { ReviewStateIdentity } from "src/core/support/task/review-agent/review_state_identity";

describe("review state identity", () => {
	test("distinguishes file boundary collisions", () => {
		const root = "/virtual/review-identity-boundary";
		const file_io = new InMemoryFileIO();
		file_io.directory_operations.create_directory(root);
		const identity = new ReviewStateIdentity(root, file_io);
		file_io.file_content.write_text(join(root, "a"), "");
		file_io.file_content.write_text(join(root, "bc"), "X");
		const first = identity.value();
		file_io.file_operations.remove_file(join(root, "a"));
		file_io.file_operations.remove_file(join(root, "bc"));
		file_io.file_content.write_text(join(root, "ab"), "");
		file_io.file_content.write_text(join(root, "c"), "X");

		expect(first === identity.value()).toBe(false);
	});

	test("changes when file content changes", () => {
		const root = "/virtual/review-identity-content";
		const file_io = new InMemoryFileIO();
		file_io.seed_files(new Map([[join(root, "source.ts"), "const value = 1;"]]));
		const identity = new ReviewStateIdentity(root, file_io);
		const first = identity.value();
		file_io.file_content.write_text(join(root, "source.ts"), "const value = 2;");

		expect(first === identity.value()).toBe(false);
	});
});
