import "src/core/lint_project_context_creator";
import { describe, expect, test } from "@jest/globals";
import { GlobalAnalysisCache } from "src/core/cache/global_analysis_cache";
import { InMemoryFileIO } from "tests/bridge/ts/core/cache/in_memory_file_io";
import { CacheFixtureBuilder } from "tests/bridge/ts/runner/orchestration/runtime/cache_fixture_builder";

describe("GlobalAnalysisCache validity", () => {
	const fixtures = new CacheFixtureBuilder();

	test("invalidates diagnostics when file selection changes", () => {
		const fixture = fixtures.create(new InMemoryFileIO());
		const initial_options = fixture.global_cache_options(new Set([fixture._file]), new Set(), []);
		const initial_cache = new GlobalAnalysisCache(initial_options);
		initial_cache.write([fixture._violation]);
		const changed_selection_options = fixture.global_cache_options(new Set(), new Set(), []);
		const changed_selection_cache = new GlobalAnalysisCache(changed_selection_options);
		const selection_result = changed_selection_cache.cached_violations();
		expect(selection_result.available).toBe(false);
	});

	test("invalidates diagnostics when entry files change", () => {
		const fixture = fixtures.create(new InMemoryFileIO());
		const initial_options = fixture.global_cache_options(new Set([fixture._file]), new Set(), []);
		const initial_cache = new GlobalAnalysisCache(initial_options);
		initial_cache.write([fixture._violation]);
		const changed_entry_options = fixture.global_cache_options(new Set([fixture._file]), new Set(), ["module.ts"]);
		const changed_entry_cache = new GlobalAnalysisCache(changed_entry_options);
		const entry_result = changed_entry_cache.cached_violations();
		expect(entry_result.available).toBe(false);
	});

	test("invalidates diagnostics when module resolution changes", () => {
		const fixture = fixtures.create(new InMemoryFileIO());
		const initial_options = fixture.global_cache_options(new Set([fixture._file]), new Set(), []);
		const initial_cache = new GlobalAnalysisCache(initial_options);
		initial_cache.write([fixture._violation]);
		fixture.write_source(fixture._typescript_config_file, '{"compilerOptions":{"baseUrl":"src"}}\n');
		const changed_resolution_options = fixture.global_cache_options(new Set([fixture._file]), new Set(), []);
		const changed_resolution_cache = new GlobalAnalysisCache(changed_resolution_options);
		const resolution_result = changed_resolution_cache.cached_violations();
		expect(resolution_result.available).toBe(false);
	});

	test("invalidates diagnostics when Python entry-point metadata changes", () => {
		const fixture = fixtures.create(new InMemoryFileIO());
		const original_options = fixture.global_cache_options(new Set([fixture._file]), new Set(), []);
		const original_cache = new GlobalAnalysisCache(original_options);
		original_cache.write([fixture._violation]);
		fixture.write_source(
			`${fixture._root}/pyproject.toml`,
			'[project.entry-points."example.plugins"]\nitem = "second:Plugin"\n',
		);
		const changed_options = fixture.global_cache_options(new Set([fixture._file]), new Set(), []);
		const changed_cache = new GlobalAnalysisCache(changed_options);
		const changed_result = changed_cache.cached_violations();
		expect(changed_result.available).toBe(false);
	});

	test("rejects malformed global cache diagnostics", () => {
		const fixture = fixtures.create(new InMemoryFileIO());
		const options = fixture.global_cache_options(new Set([fixture._file]), new Set(), []);
		const cache = new GlobalAnalysisCache(options);
		cache.write([fixture._violation]);
		const corrupted = fixture.corrupt_cache("global");
		const result = cache.cached_violations();
		expect({ corrupted, available: result.available }).toEqual({ corrupted: true, available: false });
	});

	test("treats null global diagnostics as a cache miss", () => {
		const fixture = fixtures.create(new InMemoryFileIO());
		const options = fixture.global_cache_options(new Set([fixture._file]), new Set(), []);
		const cache = new GlobalAnalysisCache(options);
		cache.write([fixture._violation]);
		const corrupted = fixture.corrupt_with_null_diagnostic("global");
		const result = cache.cached_violations();
		expect({ corrupted, available: result.available }).toEqual({ corrupted: true, available: false });
	});
});
