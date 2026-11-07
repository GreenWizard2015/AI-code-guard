import { join } from "node:path";
import { describe, expect, test } from "@jest/globals";
import { LintExecutionCacheContext } from "src/core/cache/lint_execution_cache_context";
import { LintExecutionCacheLookup } from "src/core/cache/lint_execution_cache_lookup";
import { ViolationValue } from "src/model/violation_value";
import { InMemoryFileIO } from "tests/bridge/ts/core/cache/in_memory_file_io";
import { CompleteCacheFixture } from "tests/bridge/ts/core/complete-cache-fixture";

describe("cached result invalidation", () => {
	test("invalidates results when ordinary directory entries change", () => {
		const fixture = new CompleteCacheFixture(new InMemoryFileIO());
		const context = new LintExecutionCacheContext(fixture.cache_context_options(new Map(), fixture._analysis_identity));
		context.lint_cache().write({ files: [fixture._file], violations: [] });
		fixture.write_source(join(fixture.root, "ordinary.txt"), "not a source input\n");
		const changed_context = new LintExecutionCacheContext(
			fixture.cache_context_options(new Map(), fixture._analysis_identity),
		);
		const result = changed_context.lint_cache().cached_result();
		expect(result.available).toBe(false);
	});

	test("reuses inputs after a transient root entry is removed", () => {
		const fixture = new CompleteCacheFixture(new InMemoryFileIO());
		const context = new LintExecutionCacheContext(fixture.cache_context_options(new Map(), fixture._analysis_identity));
		context.lint_cache().write({ files: [fixture._file], violations: [] });
		const temporary_file = join(fixture.root, "temporary-publication-entry");
		fixture.write_source(temporary_file, "temporary\n");
		fixture._file_io.file(temporary_file).remove_file();
		fixture._source_texts.delete(temporary_file);
		const lookup = new LintExecutionCacheLookup(fixture.root, fixture._file_io);
		const result = lookup.reusable_inputs(fixture._options);
		expect(result.available).toBe(true);
	});

	test("invalidates results when the source snapshot changes", () => {
		const fixture = new CompleteCacheFixture(new InMemoryFileIO());
		fixture.write_source(fixture._file, fixture.changed_source);
		const stale_context = new LintExecutionCacheContext(
			fixture.cache_context_options(new Map([[fixture._file, fixture.initial_source]]), fixture._analysis_identity),
		);
		const current_context = new LintExecutionCacheContext(
			fixture.cache_context_options(new Map([[fixture._file, fixture.changed_source]]), fixture._analysis_identity),
		);
		stale_context.lint_cache().write({ files: [fixture._file], violations: [] });
		const result = current_context.lint_cache().cached_result();
		expect(result.available).toBe(false);
	});

	test("invalidates results when ignored directories change", () => {
		const fixture = new CompleteCacheFixture(new InMemoryFileIO());
		const original = new LintExecutionCacheContext(
			fixture.cache_context_options(new Map(), fixture._analysis_identity),
		);
		original.lint_cache().write({ files: [fixture._file], violations: [] });
		const changed_options = {
			...fixture.cache_context_options(new Map(), fixture._analysis_identity),
			options: { ...fixture._options, ignored_directories: ["generated"] },
		};
		const changed = new LintExecutionCacheContext(changed_options);

		expect(changed.lint_cache().cached_result().available).toBe(false);
	});

	test("invalidates cached results when Python project entry-point metadata changes", () => {
		const fixture = new CompleteCacheFixture(new InMemoryFileIO());
		const initial = new LintExecutionCacheContext(fixture.cache_context_options(new Map(), fixture._analysis_identity));
		initial.lint_cache().write({ files: [fixture._file], violations: [] });
		fixture.write_source(
			fixture._python_config_file,
			'[project.entry-points."example.plugins"]\nitem = "first:Plugin"\n',
		);
		const changed = new LintExecutionCacheContext(fixture.cache_context_options(new Map(), fixture._analysis_identity));

		expect(changed.lint_cache().cached_result().available).toBe(false);
	});

	test("invalidates cached results when runtime module contents change", () => {
		const fixture = new CompleteCacheFixture(new InMemoryFileIO());
		const runtime_file = join(fixture.root, "worker.mjs");
		fixture.write_source(runtime_file, "export class Worker {}\n");
		fixture._file_io.preserve_metadata(runtime_file);
		const initial = new LintExecutionCacheContext(fixture.cache_context_options(new Map(), fixture._analysis_identity));
		initial.lint_cache().write({ files: [fixture._file], violations: [] });
		fixture.write_source(runtime_file, "export function Worker() {}\n");
		const changed = new LintExecutionCacheContext(fixture.cache_context_options(new Map(), fixture._analysis_identity));

		expect(changed.lint_cache().cached_result().available).toBe(false);
	});

	test("invalidates cached diagnostics after a same-size edit with unchanged metadata", () => {
		const fixture = new CompleteCacheFixture(new InMemoryFileIO());
		const original_metadata = fixture._file_io.file(fixture._file).metadata();
		const context = new LintExecutionCacheContext(fixture.cache_context_options(new Map(), fixture._analysis_identity));
		context.lint_cache().write({
			files: [fixture._file],
			violations: [
				new ViolationValue({
					file: fixture._file,
					line: 1,
					message: "stale diagnostic",
					hint: "must not be reused",
					rule_id: "stale-cache-diagnostic",
					priority: 1,
				}),
			],
		});
		fixture._file_io.preserve_metadata(fixture._file);
		fixture.write_source(fixture._file, fixture.changed_source);
		const changed_options = fixture.cache_context_options(new Map(), fixture._analysis_identity);
		const changed_context = new LintExecutionCacheContext(changed_options);
		const result = changed_context.lint_cache().cached_result();

		expect({
			same_size: Buffer.byteLength(fixture.initial_source) === Buffer.byteLength(fixture.changed_source),
			metadata_unchanged: fixture._file_io.file(fixture._file).metadata().mtime_ms === original_metadata.mtime_ms,
			cache_available: result.available,
			stale_diagnostic_returned: result.value.violations.some((item) => item.rule_id() === "stale-cache-diagnostic"),
		}).toEqual({ same_size: true, metadata_unchanged: true, cache_available: false, stale_diagnostic_returned: false });
	});
});
