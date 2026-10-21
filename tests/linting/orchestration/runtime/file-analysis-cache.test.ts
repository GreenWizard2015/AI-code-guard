import { join } from "node:path";
import { describe, expect, test } from "@jest/globals";
import { FileAnalysisCache } from "src/linting/orchestration/runtime/file_analysis_cache";
import { CacheFixtureBuilder } from "tests/bridge/ts/runner/orchestration/runtime/cache_fixture_builder";

describe("FileAnalysisCache", () => {
	const fixtures = new CacheFixtureBuilder();

	test("reuses diagnostics for unchanged source content", () => {
		const fixture = fixtures.create();
		const cache = new FileAnalysisCache(
			fixture.root,
			[fixture.record],
			fixture.analysis_identity,
			fixture.file_io,
			fixture.source_io,
		);
		cache.write(fixture.file, fixture.text, false, [fixture.violation]);
		const hit = cache.cached_violations(fixture.file, fixture.text, false);

		expect({ available: hit.available, details: hit.value.map((item) => item.details()) }).toEqual({
			available: true,
			details: [fixture.violation.details()],
		});
	});

	test("rejects changed source, ignored mode, and project context", () => {
		const fixture = fixtures.create();
		const cache = new FileAnalysisCache(
			fixture.root,
			[fixture.record],
			fixture.analysis_identity,
			fixture.file_io,
			fixture.source_io,
		);
		cache.write(fixture.file, fixture.text, false, [fixture.violation]);
		const changed = cache.cached_violations(fixture.file, "export const value = 2;\n", false);
		const ignored = cache.cached_violations(fixture.file, fixture.text, true);
		const changed_context_cache = new FileAnalysisCache(
			fixture.root,
			[{ ...fixture.record, text: "changed project context" }],
			fixture.analysis_identity,
			fixture.file_io,
			fixture.source_io,
		);
		const changed_context = changed_context_cache.cached_violations(fixture.file, fixture.text, false);

		expect({ changed: changed.available, ignored: ignored.available, context: changed_context.available }).toEqual({
			changed: false,
			ignored: false,
			context: false,
		});
	});

	test("invalidates cached diagnostics when TypeScript resolution changes", () => {
		const fixture = fixtures.create();
		const cache = new FileAnalysisCache(
			fixture.root,
			[fixture.record],
			fixture.analysis_identity,
			fixture.file_io,
			fixture.source_io,
		);
		cache.write(fixture.file, fixture.text, false, [fixture.violation]);
		fixture.write_source(
			fixture.typescript_config_file,
			'{"compilerOptions":{"baseUrl":".","paths":{"alias/*":["second/*"]}}}\n',
		);
		const refreshed = new FileAnalysisCache(
			fixture.root,
			[fixture.record],
			fixture.analysis_identity,
			fixture.file_io,
			fixture.source_io,
		);
		expect(refreshed.cached_violations(fixture.file, fixture.text, false).available).toBe(false);
	});

	test("invalidates cached diagnostics when a source directory appears", () => {
		const fixture = fixtures.create();
		const cache = new FileAnalysisCache(
			fixture.root,
			[fixture.record],
			fixture.analysis_identity,
			fixture.file_io,
			fixture.source_io,
		);
		cache.write(fixture.file, fixture.text, false, [fixture.violation]);
		fixture.file_io.directory_operations.create_directory(join(fixture.root, "src", "widgets"));
		const refreshed = new FileAnalysisCache(
			fixture.root,
			[fixture.record],
			fixture.analysis_identity,
			fixture.file_io,
			fixture.source_io,
		);

		expect(refreshed.cached_violations(fixture.file, fixture.text, false).available).toBe(false);
	});

	test("removes cached diagnostics for deleted project files", () => {
		const fixture = fixtures.create();
		const cache = new FileAnalysisCache(
			fixture.root,
			[fixture.record],
			fixture.analysis_identity,
			fixture.file_io,
			fixture.source_io,
		);
		cache.write(fixture.file, fixture.text, false, []);
		cache.clean_unused_records([]);

		expect(fixture.file_io.directory_entries.list_files(join(fixture.root, ".ai-code-guard", "cache", "file"))).toEqual(
			[],
		);
	});

	test("rejects malformed cached diagnostics", () => {
		const fixture = fixtures.create();
		const cache = new FileAnalysisCache(
			fixture.root,
			[fixture.record],
			fixture.analysis_identity,
			fixture.file_io,
			fixture.source_io,
		);
		cache.write(fixture.file, fixture.text, false, [fixture.violation]);
		const corrupted = fixture.corrupt_cache("file");

		expect({ corrupted, available: cache.cached_violations(fixture.file, fixture.text, false).available }).toEqual({
			corrupted: true,
			available: false,
		});
	});

	test("treats null diagnostics as a cache miss", () => {
		const fixture = fixtures.create();
		const cache = new FileAnalysisCache(
			fixture.root,
			[fixture.record],
			fixture.analysis_identity,
			fixture.file_io,
			fixture.source_io,
		);
		cache.write(fixture.file, fixture.text, false, [fixture.violation]);
		const corrupted = fixture.corrupt_with_null_diagnostic("file");

		expect({ corrupted, available: cache.cached_violations(fixture.file, fixture.text, false).available }).toEqual({
			corrupted: true,
			available: false,
		});
	});
});
