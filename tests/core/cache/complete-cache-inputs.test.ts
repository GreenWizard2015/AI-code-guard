import { join } from "node:path";
import { describe, expect, test } from "@jest/globals";
import { LintExecutionCacheContext } from "src/core/cache/lint_execution_cache_context";
import { LintExecutionCacheLookup } from "src/core/cache/lint_execution_cache_lookup";
import type { CliOptions } from "src/task_types";
import { ViolationValue } from "src/violation_value";
import { CompleteCacheFixture } from "tests/bridge/ts/core/complete-cache-fixture";

describe("complete cache input validation", () => {
	test("reuses unchanged inputs", () => {
		const fixture = new CompleteCacheFixture();
		const context = new LintExecutionCacheContext(fixture.cache_context_options(new Map(), fixture.analysis_identity));
		const cache = context.lint_cache();
		cache.write({ files: [fixture.file], violations: [] });
		const lookup = new LintExecutionCacheLookup(fixture.root, fixture.file_io);
		const result = lookup.reusable_inputs([], fixture.options);
		expect({ available: result.available, inputs: result.value }).toEqual({ available: true, inputs: fixture.inputs });
	});

	test("invalidates input reuse when entry files change", () => {
		const fixture = new CompleteCacheFixture();
		const context = new LintExecutionCacheContext(fixture.cache_context_options(new Map(), fixture.analysis_identity));
		context.lint_cache().write({ files: [fixture.file], violations: [] });
		const options: CliOptions = { ...fixture.options, entry_files: [fixture.file] };
		const lookup = new LintExecutionCacheLookup(fixture.root, fixture.file_io);
		const result = lookup.reusable_inputs([], options);
		expect(result.available).toBe(false);
	});

	test("invalidates input reuse when ignore files change", () => {
		const fixture = new CompleteCacheFixture();
		const context = new LintExecutionCacheContext(fixture.cache_context_options(new Map(), fixture.analysis_identity));
		context.lint_cache().write({ files: [fixture.file], violations: [] });
		fixture.write_source(fixture.ignore_file, "coverage/\nlogs/\n");
		const lookup = new LintExecutionCacheLookup(fixture.root, fixture.file_io);
		const result = lookup.reusable_inputs([], fixture.options);
		expect(result.available).toBe(false);
	});

	test("invalidates input reuse when a nested directory appears", () => {
		const fixture = new CompleteCacheFixture();
		const context = new LintExecutionCacheContext(fixture.cache_context_options(new Map(), fixture.analysis_identity));
		context.lint_cache().write({ files: [fixture.file], violations: [] });
		fixture.create_nested_input();
		const lookup = new LintExecutionCacheLookup(fixture.root, fixture.file_io);
		const result = lookup.reusable_inputs([], fixture.options);
		expect(result.available).toBe(false);
	});

	test("invalidates results when ordinary directory entries change", () => {
		const fixture = new CompleteCacheFixture();
		const context = new LintExecutionCacheContext(fixture.cache_context_options(new Map(), fixture.analysis_identity));
		context.lint_cache().write({ files: [fixture.file], violations: [] });
		fixture.write_source(join(fixture.root, "ordinary.txt"), "not a source input\n");
		const changed_context = new LintExecutionCacheContext(
			fixture.cache_context_options(new Map(), fixture.analysis_identity),
		);
		const result = changed_context.lint_cache().cached_result();
		expect(result.available).toBe(false);
	});

	test("reuses inputs after a transient root entry is removed", () => {
		const fixture = new CompleteCacheFixture();
		const context = new LintExecutionCacheContext(fixture.cache_context_options(new Map(), fixture.analysis_identity));
		context.lint_cache().write({ files: [fixture.file], violations: [] });
		const temporary_file = join(fixture.root, "temporary-publication-entry");
		fixture.write_source(temporary_file, "temporary\n");
		fixture.file_io.file_operations.remove_file(temporary_file);
		fixture.source_texts.delete(temporary_file);
		const lookup = new LintExecutionCacheLookup(fixture.root, fixture.file_io);
		const result = lookup.reusable_inputs([], fixture.options);
		expect(result.available).toBe(true);
	});

	test("invalidates results when the source snapshot changes", () => {
		const fixture = new CompleteCacheFixture();
		fixture.write_source(fixture.file, fixture.changed_source);
		const stale_context = new LintExecutionCacheContext(
			fixture.cache_context_options(new Map([[fixture.file, fixture.initial_source]]), fixture.analysis_identity),
		);
		const current_context = new LintExecutionCacheContext(
			fixture.cache_context_options(new Map([[fixture.file, fixture.changed_source]]), fixture.analysis_identity),
		);
		stale_context.lint_cache().write({ files: [fixture.file], violations: [] });
		const result = current_context.lint_cache().cached_result();
		expect(result.available).toBe(false);
	});

	test("invalidates cached diagnostics after a same-size edit with unchanged metadata", () => {
		const fixture = new CompleteCacheFixture();
		const original_metadata = fixture.file_io.file_paths.metadata(fixture.file);
		const context = new LintExecutionCacheContext(fixture.cache_context_options(new Map(), fixture.analysis_identity));
		context.lint_cache().write({
			files: [fixture.file],
			violations: [
				new ViolationValue({
					file: fixture.file,
					line: 1,
					message: "stale diagnostic",
					hint: "must not be reused",
					rule_id: "stale-cache-diagnostic",
					priority: 1,
				}),
			],
		});
		fixture.file_io.preserve_metadata(fixture.file);
		fixture.write_source(fixture.file, fixture.changed_source);
		const changed_options = fixture.cache_context_options(new Map(), fixture.analysis_identity);
		const changed_context = new LintExecutionCacheContext(changed_options);
		const result = changed_context.lint_cache().cached_result();

		expect({
			same_size: Buffer.byteLength(fixture.initial_source) === Buffer.byteLength(fixture.changed_source),
			metadata_unchanged: fixture.file_io.file_paths.metadata(fixture.file).mtime_ms === original_metadata.mtime_ms,
			cache_available: result.available,
			stale_diagnostic_returned: result.value.violations.some((item) => item.rule_id === "stale-cache-diagnostic"),
		}).toEqual({ same_size: true, metadata_unchanged: true, cache_available: false, stale_diagnostic_returned: false });
	});
});
