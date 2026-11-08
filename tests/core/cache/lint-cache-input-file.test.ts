import { describe, expect, test } from "@jest/globals";
import { LintCacheInputFile } from "src/core/cache/lint_cache_input_file";
import { InMemoryFileIO } from "tests/bridge/ts/core/cache/in_memory_file_io";

describe("lint cache input file fingerprints", () => {
	test.each(["\n", "\r\n", "\r"])("matches unchanged ignore content using %p line endings", (newline) => {
		const path = "/virtual/cache-input/.gitignore";
		const io = new InMemoryFileIO();
		io.seed_files(new Map([[path, `*.log${newline}`]]));
		const input = new LintCacheInputFile(path, io);
		const previous = input.snapshot_fingerprint("*.log\n");

		expect(input.ignore_file_matches(previous)).toBe(true);
	});

	test("rejects changed ignore content after normalizing line endings", () => {
		const path = "/virtual/cache-input/.gitignore";
		const io = new InMemoryFileIO();
		io.seed_files(new Map([[path, "*.tmp\r\n"]]));
		const input = new LintCacheInputFile(path, io);
		const previous = input.snapshot_fingerprint("*.log\n");

		expect(input.ignore_file_matches(previous)).toBe(false);
	});
});
