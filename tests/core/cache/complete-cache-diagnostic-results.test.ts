import { join } from "node:path";
import { describe, expect, test } from "@jest/globals";
import { LintExecutionCacheContext } from "src/core/cache/lint_execution_cache_context";
import { LintExecutionCacheLookup } from "src/core/cache/lint_execution_cache_lookup";
import { LintExecutionCachePreparer } from "src/core/cache/lint_execution_cache_preparer";
import { LintStageTimer } from "src/lint_stage_timer";
import { ViolationValue } from "src/violation_value";
import { CompleteCacheFixture } from "tests/bridge/ts/core/complete-cache-fixture";

describe("complete cache diagnostic results", () => {
	test("round-trips cached diagnostic details", () => {
		const fixture = new CompleteCacheFixture();
		const context = new LintExecutionCacheContext(fixture.cache_context_options(new Map(), fixture.analysis_identity));
		const cache = context.lint_cache();
		const violation = new ViolationValue({
			file: "module.ts",
			line: 1,
			message: "blocking diagnostic",
			hint: "fix the diagnostic",
			rule_id: "test-rule",
			priority: 1,
		});
		cache.write({ files: [fixture.file], violations: [violation] });
		const result = cache.cached_result();
		const details = result.value.violations.map((item) => item.details());
		expect({ available: result.available, details }).toEqual({
			available: true,
			details: [
				{
					file: "module.ts",
					line: 1,
					message: "blocking diagnostic",
					hint: "fix the diagnostic",
					rule_id: "test-rule",
					priority: 1,
				},
			],
		});
	});

	test("preserves a cached result after a transient root entry is removed", () => {
		const fixture = new CompleteCacheFixture();
		const context = new LintExecutionCacheContext(fixture.cache_context_options(new Map(), fixture.analysis_identity));
		context.lint_cache().write({ files: [fixture.file], violations: [] });
		const temporary_file = join(fixture.root, "temporary-publication-entry");
		fixture.write_source(temporary_file, "temporary\n");
		fixture.file_io.file_operations.remove_file(temporary_file);
		fixture.source_texts.delete(temporary_file);
		const unchanged_context = new LintExecutionCacheContext(
			fixture.cache_context_options(new Map(), fixture.analysis_identity),
		);
		const result = unchanged_context.lint_cache().cached_result();
		expect(result.available).toBe(true);
	});

	test("does not prepare source text when the complete result is reusable", () => {
		const fixture = new CompleteCacheFixture();
		const context = new LintExecutionCacheContext(
			fixture.cache_context_options(new Map([[fixture.file, fixture.initial_source]]), fixture.analysis_identity),
		);
		context.lint_cache().write({ files: [fixture.file], violations: [] });
		let discovery_calls = 0;
		const preparer = new LintExecutionCachePreparer(
			{
				input_files: () => {
					discovery_calls += 1;
					return fixture.inputs;
				},
			},
			fixture.file_io,
			fixture.source_io,
			fixture.analysis_identity,
		);
		const prepared = preparer.complete_cache(fixture.options, new LintStageTimer());
		const result = prepared.cache.cached_result();
		const state = { available: result.available, source_text_count: prepared.source_texts.size, discovery_calls };
		expect(state).toEqual({ available: true, source_text_count: 0, discovery_calls: 0 });
	});

	test("loads changed source text after the complete result misses", () => {
		const fixture = new CompleteCacheFixture();
		const context = new LintExecutionCacheContext(
			fixture.cache_context_options(new Map([[fixture.file, fixture.initial_source]]), fixture.analysis_identity),
		);
		context.lint_cache().write({ files: [fixture.file], violations: [] });
		fixture.write_source(fixture.file, fixture.changed_source);
		const preparer = new LintExecutionCachePreparer(
			{ input_files: () => fixture.inputs },
			fixture.file_io,
			fixture.source_io,
			fixture.analysis_identity,
		);
		const prepared = preparer.complete_cache(fixture.options, new LintStageTimer());
		const result = prepared.cache.cached_result();
		const analysis = preparer.prepare_for_inputs(fixture.options, new LintStageTimer(), prepared.inputs);
		expect({ cached: result.available, source: analysis.source_texts.get(fixture.file) }).toEqual({
			cached: false,
			source: fixture.changed_source,
		});
	});

	test("treats malformed cache records as misses", () => {
		const fixture = new CompleteCacheFixture();
		const cache_directory = join(fixture.root, ".ai-code-guard", "cache", "lint-execution");
		fixture.file_io.directory_operations.create_directory(cache_directory);
		fixture.file_io.file_content.write_text(join(cache_directory, "lint-result.json"), "null");
		const lookup = new LintExecutionCacheLookup(fixture.root, fixture.file_io);
		const result = lookup.reusable_inputs([], fixture.options);
		expect(result.available).toBe(false);
	});

	test("treats malformed cached fingerprints as misses", () => {
		const fixture = new CompleteCacheFixture();
		const context = new LintExecutionCacheContext(fixture.cache_context_options(new Map(), fixture.analysis_identity));
		const cache = context.lint_cache();
		cache.write({ files: [fixture.file], violations: [] });
		const cache_file = join(fixture.root, ".ai-code-guard", "cache", "lint-execution", "lint-result.json");
		const record = fixture.file_io.file_content.file_text(cache_file);
		fixture.file_io.file_content.write_text(
			cache_file,
			record.replace(/"fingerprints":\[[^\]]*\]/, '"fingerprints":[null]'),
		);
		const lookup = new LintExecutionCacheLookup(fixture.root, fixture.file_io);
		const result = lookup.reusable_inputs([], fixture.options);
		expect(result.available).toBe(false);
	});
});
