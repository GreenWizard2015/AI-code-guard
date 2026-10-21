import { describe, expect, test } from "@jest/globals";
import { GlobalAnalysisCache } from "src/core/support/global_analysis_cache";
import { CacheFixtureBuilder } from "tests/bridge/ts/runner/orchestration/runtime/cache_fixture_builder";

describe("GlobalAnalysisCache", () => {
	const fixtures = new CacheFixtureBuilder();
	test("invalidates diagnostics when selection, entry files, or resolution changes", () => {
		const fixture = fixtures.create();
		const cache = new GlobalAnalysisCache(fixture.global_cache_options(new Set([fixture.file]), new Set(), []));
		cache.write([fixture.violation]);
		const changed_selection_cache = new GlobalAnalysisCache(fixture.global_cache_options(new Set(), new Set(), []));
		const selection_changed = changed_selection_cache.cached_violations();
		const changed_entry_cache = new GlobalAnalysisCache(
			fixture.global_cache_options(new Set([fixture.file]), new Set(), ["module.ts"]),
		);
		const entry_files_changed = changed_entry_cache.cached_violations();
		fixture.write_source(fixture.typescript_config_file, '{"compilerOptions":{"baseUrl":"src"}}\n');
		const changed_resolution_cache = new GlobalAnalysisCache(
			fixture.global_cache_options(new Set([fixture.file]), new Set(), []),
		);
		const resolution_changed = changed_resolution_cache.cached_violations();

		expect({
			selection: selection_changed.available,
			entries: entry_files_changed.available,
			resolution: resolution_changed.available,
		}).toEqual({
			selection: false,
			entries: false,
			resolution: false,
		});
	});

	test("rejects malformed global cache diagnostics", () => {
		const fixture = fixtures.create();
		const cache = new GlobalAnalysisCache(fixture.global_cache_options(new Set([fixture.file]), new Set(), []));
		cache.write([fixture.violation]);
		const corrupted = fixture.corrupt_cache("global");

		expect({ corrupted, available: cache.cached_violations().available }).toEqual({
			corrupted: true,
			available: false,
		});
	});

	test("treats null global diagnostics as a cache miss", () => {
		const fixture = fixtures.create();
		const cache = new GlobalAnalysisCache(fixture.global_cache_options(new Set([fixture.file]), new Set(), []));
		cache.write([fixture.violation]);
		const corrupted = fixture.corrupt_with_null_diagnostic("global");

		expect({ corrupted, available: cache.cached_violations().available }).toEqual({
			corrupted: true,
			available: false,
		});
	});
});
