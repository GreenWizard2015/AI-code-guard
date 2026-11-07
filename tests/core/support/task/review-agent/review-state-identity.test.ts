import "src/core/lint_project_context_creator";
import { join } from "node:path";
import { describe, expect, test } from "@jest/globals";
import { ReviewStateIdentity } from "src/core/support/task/review-agent/review_state_identity";
import { ReviewAgentIdentity } from "src/core/support/task/review_agent_identity";
import { InMemoryFileIO } from "tests/bridge/ts/core/cache/in_memory_file_io";
import { DirectoryCreationFailureFileIO } from "tests/core/support/task/review-agent/directory-creation-failure-file-io";

describe("review state identity", () => {
	test("distinguishes file boundary collisions", () => {
		const root = "/virtual/review-identity-boundary";
		const file_io = new InMemoryFileIO();
		file_io.create_directory(root);
		const identity = new ReviewStateIdentity(root, file_io);
		file_io.file(join(root, "a")).write_text("");
		file_io.file(join(root, "bc")).write_text("X");
		const first = identity.value();
		file_io.file(join(root, "a")).remove_file();
		file_io.file(join(root, "bc")).remove_file();
		file_io.file(join(root, "ab")).write_text("");
		file_io.file(join(root, "c")).write_text("X");

		expect(first === identity.value()).toBe(false);
	});

	test("changes when file content changes", () => {
		const root = "/virtual/review-identity-content";
		const file_io = new InMemoryFileIO();
		file_io.seed_files(new Map([[join(root, "source.ts"), "const value = 1;"]]));
		const identity = new ReviewStateIdentity(root, file_io);
		const first = identity.value();
		file_io.file(join(root, "source.ts")).write_text("const value = 2;");

		expect(first === identity.value()).toBe(false);
	});

	test("returns system failures while persisting agent ownership", () => {
		const root = "/virtual/review-identity-write-failure";
		const file_io = new DirectoryCreationFailureFileIO();
		const identity = new ReviewAgentIdentity({
			pid: 4321,
			start_time: "start",
			boot_id: "boot",
			available: true,
			file_io,
			ownership_token: "",
		});

		const failure = identity.persist(root, "");
		expect({
			failure: failure.includes("ENOENT"),
			attempted_directories: file_io.attempted_directories(),
			attempted_moves: file_io.attempted_moves(),
		}).toEqual({
			failure: true,
			attempted_directories: [join(root, ".ai-code-guard", "review", ".review-run-lock", "agents")],
			attempted_moves: [],
		});
	});
});
