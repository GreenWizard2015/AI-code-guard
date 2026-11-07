import { join } from "node:path";
import { describe, expect, test } from "@jest/globals";
import { FileAnalysisCache } from "src/linting/orchestration/runtime/file_analysis_cache";
import { InMemoryFileIO } from "tests/bridge/ts/core/cache/in_memory_file_io";
import { CacheFixtureBuilder } from "tests/bridge/ts/runner/orchestration/runtime/cache_fixture_builder";

describe("FileAnalysisCache", () => {
	const fixtures = new CacheFixtureBuilder();

	test("reuses diagnostics for unchanged source content", () => {
		const fixture = fixtures.create(new InMemoryFileIO());
		const cache = new FileAnalysisCache({
			repo_root: fixture._root,
			analysis_identity: fixture._analysis_identity,
			context_identity: fixture._analysis_identity.context([fixture._record]),
			file_io: fixture._file_io,
			source_io: fixture._source_io,
		});
		cache.write(fixture._file, fixture._text, false, [fixture._violation]);
		const hit = cache.cached_violations(fixture._file, fixture._text, false);

		expect({
			available: hit.available,
			details: hit.value.map((item) => [
				item.file(),
				item.line(),
				item.message(),
				item.hint(),
				item.rule_id(),
				item.priority(),
			]),
		}).toEqual({
			available: true,
			details: [
				[
					fixture._violation.file(),
					fixture._violation.line(),
					fixture._violation.message(),
					fixture._violation.hint(),
					fixture._violation.rule_id(),
					fixture._violation.priority(),
				],
			],
		});
	});

	test("rejects changed source, ignored mode, and project context", () => {
		const fixture = fixtures.create(new InMemoryFileIO());
		const cache = new FileAnalysisCache({
			repo_root: fixture._root,
			analysis_identity: fixture._analysis_identity,
			context_identity: fixture._analysis_identity.context([fixture._record]),
			file_io: fixture._file_io,
			source_io: fixture._source_io,
		});
		cache.write(fixture._file, fixture._text, false, [fixture._violation]);
		const changed = cache.cached_violations(fixture._file, "export const value = 2;\n", false);
		const ignored = cache.cached_violations(fixture._file, fixture._text, true);
		const changed_record = fixtures.source_record(fixture._file, "changed project context");
		const changed_context_cache = new FileAnalysisCache({
			repo_root: fixture._root,
			analysis_identity: fixture._analysis_identity,
			context_identity: fixture._analysis_identity.context([changed_record]),
			file_io: fixture._file_io,
			source_io: fixture._source_io,
		});
		const changed_context = changed_context_cache.cached_violations(fixture._file, fixture._text, false);

		expect({ changed: changed.available, ignored: ignored.available, context: changed_context.available }).toEqual({
			changed: false,
			ignored: false,
			context: false,
		});
	});

	test("invalidates cached diagnostics when TypeScript resolution changes", () => {
		const fixture = fixtures.create(new InMemoryFileIO());
		const context_identity = fixture._analysis_identity.context([fixture._record]);
		const cache = new FileAnalysisCache({
			repo_root: fixture._root,
			analysis_identity: fixture._analysis_identity,
			context_identity,
			file_io: fixture._file_io,
			source_io: fixture._source_io,
		});
		cache.write(fixture._file, fixture._text, false, [fixture._violation]);
		fixture.write_source(
			fixture._typescript_config_file,
			'{"compilerOptions":{"baseUrl":".","paths":{"alias/*":["second/*"]}}}\n',
		);
		const refreshed = new FileAnalysisCache({
			repo_root: fixture._root,
			analysis_identity: fixture._analysis_identity,
			context_identity,
			file_io: fixture._file_io,
			source_io: fixture._source_io,
		});
		expect(refreshed.cached_violations(fixture._file, fixture._text, false).available).toBe(false);
	});

	test("invalidates cached diagnostics when a source directory appears", () => {
		const fixture = fixtures.create(new InMemoryFileIO());
		const context_identity = fixture._analysis_identity.context([fixture._record]);
		const cache = new FileAnalysisCache({
			repo_root: fixture._root,
			analysis_identity: fixture._analysis_identity,
			context_identity,
			file_io: fixture._file_io,
			source_io: fixture._source_io,
		});
		cache.write(fixture._file, fixture._text, false, [fixture._violation]);
		fixture._file_io.create_directory(join(fixture._root, "src", "widgets"));
		const refreshed = new FileAnalysisCache({
			repo_root: fixture._root,
			analysis_identity: fixture._analysis_identity,
			context_identity,
			file_io: fixture._file_io,
			source_io: fixture._source_io,
		});

		expect(refreshed.cached_violations(fixture._file, fixture._text, false).available).toBe(false);
	});

	test("removes cached diagnostics for deleted project files", () => {
		const fixture = fixtures.create(new InMemoryFileIO());
		const cache = new FileAnalysisCache({
			repo_root: fixture._root,
			analysis_identity: fixture._analysis_identity,
			context_identity: fixture._analysis_identity.context([fixture._record]),
			file_io: fixture._file_io,
			source_io: fixture._source_io,
		});
		cache.write(fixture._file, fixture._text, false, []);
		cache.clean_unused_records([]);

		expect(fixture._file_io.list_files(join(fixture._root, ".ai-code-guard", "cache", "file"))).toEqual([]);
	});

	test("rejects malformed cached diagnostics", () => {
		const fixture = fixtures.create(new InMemoryFileIO());
		const cache = new FileAnalysisCache({
			repo_root: fixture._root,
			analysis_identity: fixture._analysis_identity,
			context_identity: fixture._analysis_identity.context([fixture._record]),
			file_io: fixture._file_io,
			source_io: fixture._source_io,
		});
		cache.write(fixture._file, fixture._text, false, [fixture._violation]);
		const corrupted = fixture.corrupt_cache("file");

		expect({ corrupted, available: cache.cached_violations(fixture._file, fixture._text, false).available }).toEqual({
			corrupted: true,
			available: false,
		});
	});

	test("treats null diagnostics as a cache miss", () => {
		const fixture = fixtures.create(new InMemoryFileIO());
		const cache = new FileAnalysisCache({
			repo_root: fixture._root,
			analysis_identity: fixture._analysis_identity,
			context_identity: fixture._analysis_identity.context([fixture._record]),
			file_io: fixture._file_io,
			source_io: fixture._source_io,
		});
		cache.write(fixture._file, fixture._text, false, [fixture._violation]);
		const corrupted = fixture.corrupt_with_null_diagnostic("file");

		expect({ corrupted, available: cache.cached_violations(fixture._file, fixture._text, false).available }).toEqual({
			corrupted: true,
			available: false,
		});
	});

	test("removes cache entries with invalid records during cleanup", () => {
		const fixture = fixtures.create(new InMemoryFileIO());
		const cache = new FileAnalysisCache({
			repo_root: fixture._root,
			analysis_identity: fixture._analysis_identity,
			context_identity: fixture._analysis_identity.context([fixture._record]),
			file_io: fixture._file_io,
			source_io: fixture._source_io,
		});
		cache.write(fixture._file, fixture._text, false, [fixture._violation]);
		fixture.corrupt_cache("file");
		cache.clean_unused_records([fixture._record]);

		expect(fixture._file_io.list_files(join(fixture._root, ".ai-code-guard", "cache", "file"))).toEqual([]);
	});
});
