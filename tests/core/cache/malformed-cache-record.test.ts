import { describe, expect, test } from "@jest/globals";
import { join } from "node:path";
import { InMemoryFileIO } from "tests/bridge/ts/core/cache/in_memory_file_io";
import { LintExecutionCacheLookup } from "src/core/cache/lint_execution_cache_lookup";

/** Responsibilities: _malformed cache record_, _cache lookup setup_. **/
class MalformedCacheFixture {
	public readonly root = "/virtual/malformed-cache";
	public readonly cache_file = join(this.root, ".ai-code-guard", "cache", "lint-execution", "lint-result.json");
	public readonly file_io: InMemoryFileIO;

	/** Responsibilities: _cache record setup_. **/
	public constructor(record: string) {
		this.file_io = new InMemoryFileIO();
		this.file_io.directory_operations.create_directory(join(this.root, ".ai-code-guard", "cache", "lint-execution"));
		this.file_io.file_content.write_text(this.cache_file, record);
	}
}

describe("malformed complete cache records", () => {
	test("treats malformed fingerprints as misses without throwing", () => {
		const fixture = new MalformedCacheFixture(
			JSON.stringify({
				cache_version: 1,
				identity: "identity",
				target_request: "request",
				entry_files: [],
				files: [],
				violations: [],
				fingerprints: [null],
				inputs: { files: [], project_files: [], ignored_files: [], markdown_files: [], ignore_files: [] },
				ignored_directories: [],
				directories: [],
			}),
		);
		const lookup = new LintExecutionCacheLookup(fixture.root, fixture.file_io);

		expect(lookup.previous_record.available).toBe(false);
	});

	test("treats a null cache record as a miss", () => {
		const fixture = new MalformedCacheFixture("null");
		const lookup = new LintExecutionCacheLookup(fixture.root, fixture.file_io);

		expect(lookup.previous_record.available).toBe(false);
	});
});
