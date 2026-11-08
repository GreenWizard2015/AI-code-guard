import { join } from "node:path";
import { describe, expect, test } from "@jest/globals";
import { LintExecutionCacheLookup } from "src/core/cache/lint_execution_cache_lookup";
import { ViolationCache } from "src/core/cache/violation_cache";
import { ViolationValue } from "src/model/violation_value";
import type { ReportViolationOptions } from "src/reporting_protocols";
import { InMemoryFileIO } from "tests/bridge/ts/core/cache/in_memory_file_io";

describe("malformed complete cache records", () => {
	/** Responsibilities: _malformed cache input setup_. **/
	const create_malformed_cache_fixture = (record: string): { root: string; file_io: InMemoryFileIO } => {
		const root = "/virtual/malformed-cache";
		const cache_file = join(root, ".ai-code-guard", "cache", "lint-execution", "lint-result.json");
		const file_io = new InMemoryFileIO();
		file_io.create_directory(join(root, ".ai-code-guard", "cache", "lint-execution"));
		file_io.file(cache_file).write_text(record);
		return { root, file_io };
	};

	test("treats malformed fingerprints as misses without throwing", () => {
		const fixture = create_malformed_cache_fixture(
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

		expect(
			lookup.reusable_inputs({
				root: fixture.root,
				ignored_directories: [],
				entry_files: [],
				skip_review: true,
				force_review: false,
				review_agent: "none",
				review_stages: [],
				batch_size: 10,
				policy: "all",
			}).available,
		).toBe(false);
	});

	test("treats a null cache record as a miss", () => {
		const fixture = create_malformed_cache_fixture("null");
		const lookup = new LintExecutionCacheLookup(fixture.root, fixture.file_io);

		expect(
			lookup.reusable_inputs({
				root: fixture.root,
				ignored_directories: [],
				entry_files: [],
				skip_review: true,
				force_review: false,
				review_agent: "none",
				review_stages: [],
				batch_size: 10,
				policy: "all",
			}).available,
		).toBe(false);
	});

	test("treats duplicate cached source paths as a miss", () => {
		const fixture = create_malformed_cache_fixture(
			JSON.stringify({
				cache_version: 1,
				identity: "identity",
				target_request: "",
				entry_files: [],
				files: ["/project/source.ts", "/project/source.ts"],
				violations: [],
				fingerprints: [],
				inputs: {
					files: ["/project/source.ts", "/project/source.ts"],
					project_files: ["/project/source.ts"],
					ignored_files: [],
					markdown_files: [],
					ignore_files: [],
				},
				ignored_directories: [],
				directories: [],
			}),
		);
		const lookup = new LintExecutionCacheLookup(fixture.root, fixture.file_io);

		expect(
			lookup.reusable_inputs({
				root: fixture.root,
				ignored_directories: [],
				entry_files: [],
				skip_review: true,
				force_review: false,
				review_agent: "none",
				review_stages: [],
				batch_size: 10,
				policy: "all",
			}).available,
		).toBe(false);
	});

	test("rejects null diagnostic entries without throwing", () => {
		const entries: readonly ReportViolationOptions[] = JSON.parse("[null]");
		const cache = new ViolationCache(entries);

		expect(cache.valid_cache()).toBe(false);
	});

	test("rejects coercion-shaped diagnostic fields without throwing", () => {
		const entries = JSON.parse(
			'[{"file":{"toString":null},"line":1,"message":"message","hint":"hint","rule_id":"rule","priority":1}]',
		);
		const cache = new ViolationCache(entries);

		expect(() => cache.valid_cache()).not.toThrow();
		expect(cache.valid_cache()).toBe(false);
	});

	test("rejects fractional diagnostic lines in cache and value construction", () => {
		const entry = {
			file: "module.ts",
			line: 1.5,
			message: "diagnostic",
			hint: "fix it",
			rule_id: "example-rule",
			priority: 1,
		};
		const cache = new ViolationCache([entry]);

		expect(cache.valid_cache()).toBe(false);
		expect(() => new ViolationValue(entry)).toThrow("Invalid diagnostic line 1.5");
	});

	test("preserves the zero line sentinel for file-level diagnostics", () => {
		const entry = new ViolationValue({
			file: "module.ts",
			line: 0,
			message: "file-level diagnostic",
			hint: "review the file",
			rule_id: "file-rule",
			priority: 1,
		});
		const cache = new ViolationCache([
			{
				file: entry.file(),
				line: entry.line(),
				message: entry.message(),
				hint: entry.hint(),
				rule_id: entry.rule_id(),
				priority: entry.priority(),
			},
		]);

		expect({ line: entry.line(), valid: cache.valid_cache() }).toEqual({ line: 0, valid: true });
	});
});
