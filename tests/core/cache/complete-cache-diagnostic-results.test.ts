import { join } from "node:path";
import { describe, expect, test } from "@jest/globals";
import { LintExecutionCacheContext } from "src/core/cache/lint_execution_cache_context";
import { LintExecutionCacheLookup } from "src/core/cache/lint_execution_cache_lookup";
import { LintExecutionCachePreparer } from "src/core/cache/lint_execution_cache_preparer";
import { LintStageTimer } from "src/lint_stage_timer";
import { ViolationValue } from "src/model/violation_value";
import type { LintInputFiles } from "src/project_analysis_types";
import { InMemoryFileIO } from "tests/bridge/ts/core/cache/in_memory_file_io";
import { CompleteCacheFixture } from "tests/bridge/ts/core/complete-cache-fixture";

describe("complete cache diagnostic results", () => {
	test("round-trips cached diagnostic details", () => {
		const fixture = new CompleteCacheFixture(new InMemoryFileIO());
		const context = new LintExecutionCacheContext(fixture.cache_context_options(new Map(), fixture._analysis_identity));
		const cache = context.lint_cache();
		const violation = new ViolationValue({
			file: "module.ts",
			line: 1,
			message: "blocking diagnostic",
			hint: "fix the diagnostic",
			rule_id: "test-rule",
			priority: 1,
		});
		cache.write({ files: [fixture._file], violations: [violation] });
		const result = cache.cached_result();
		const details = result.value.violations.map((item) => ({
			file: item.file(),
			line: item.line(),
			message: item.message(),
			hint: item.hint(),
			rule_id: item.rule_id(),
			priority: item.priority(),
		}));
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
		const fixture = new CompleteCacheFixture(new InMemoryFileIO());
		const context = new LintExecutionCacheContext(fixture.cache_context_options(new Map(), fixture._analysis_identity));
		context.lint_cache().write({ files: [fixture._file], violations: [] });
		const temporary_file = join(fixture.root, "temporary-publication-entry");
		fixture.write_source(temporary_file, "temporary\n");
		fixture._file_io.file(temporary_file).remove_file();
		fixture._source_texts.delete(temporary_file);
		const unchanged_context = new LintExecutionCacheContext(
			fixture.cache_context_options(new Map(), fixture._analysis_identity),
		);
		const result = unchanged_context.lint_cache().cached_result();
		expect(result.available).toBe(true);
	});

	test("does not prepare source text when the complete result is reusable", () => {
		const fixture = new CompleteCacheFixture(new InMemoryFileIO());
		const context = new LintExecutionCacheContext(
			fixture.cache_context_options(new Map([[fixture._file, fixture.initial_source]]), fixture._analysis_identity),
		);
		context.lint_cache().write({ files: [fixture._file], violations: [] });
		let discovery_calls = 0;
		const preparer = new LintExecutionCachePreparer({
			options: fixture._options,
			stage_timer: new LintStageTimer(),
			lint_input_discovery: {
				input_files: (): LintInputFiles => {
					discovery_calls += 1;
					return fixture._inputs;
				},
			},
			file_io: fixture._file_io,
			source_io: fixture._source_io,
			analysis_identity: fixture._analysis_identity,
		});
		const prepared = preparer.complete_cache();
		const result = prepared.cache.cached_result();
		const state = { available: result.available, source_text_count: prepared.source_texts.size, discovery_calls };
		expect(state).toEqual({ available: true, source_text_count: 0, discovery_calls: 0 });
	});

	test("loads changed source text after the complete result misses", () => {
		const fixture = new CompleteCacheFixture(new InMemoryFileIO());
		const context = new LintExecutionCacheContext(
			fixture.cache_context_options(new Map([[fixture._file, fixture.initial_source]]), fixture._analysis_identity),
		);
		context.lint_cache().write({ files: [fixture._file], violations: [] });
		fixture.write_source(fixture._file, fixture.changed_source);
		const preparer = new LintExecutionCachePreparer({
			options: fixture._options,
			stage_timer: new LintStageTimer(),
			lint_input_discovery: { input_files: (): LintInputFiles => fixture._inputs },
			file_io: fixture._file_io,
			source_io: fixture._source_io,
			analysis_identity: fixture._analysis_identity,
		});
		const prepared = preparer.complete_cache();
		const result = prepared.cache.cached_result();
		const analysis = preparer.prepare_for_inputs(prepared.inputs);
		expect({ cached: result.available, source: analysis.source_texts.get(fixture._file) }).toEqual({
			cached: false,
			source: fixture.changed_source,
		});
	});

	test("treats malformed cache records as misses", () => {
		const fixture = new CompleteCacheFixture(new InMemoryFileIO());
		const cache_directory = join(fixture.root, ".ai-code-guard", "cache", "lint-execution");
		fixture._file_io.create_directory(cache_directory);
		fixture._file_io.file(join(cache_directory, "lint-result.json")).write_text("null");
		const lookup = new LintExecutionCacheLookup(fixture.root, fixture._file_io);
		const result = lookup.reusable_inputs(fixture._options);
		expect(result.available).toBe(false);
	});

	test("treats non-string serialized text fields as a cache miss", () => {
		const fixture = new CompleteCacheFixture(new InMemoryFileIO());
		const context = new LintExecutionCacheContext(fixture.cache_context_options(new Map(), fixture._analysis_identity));
		const cache = context.lint_cache();
		cache.write({ files: [fixture._file], violations: [] });
		const cache_file = join(fixture.root, ".ai-code-guard", "cache", "lint-execution", "lint-result.json");
		const malformed_record = {
			...JSON.parse(fixture._file_io.file(cache_file).file_text()),
			violations: [{ file: fixture._file, line: 1, message: { toString: null } }],
		};
		fixture._file_io.file(cache_file).write_text(JSON.stringify(malformed_record));

		const lookup = new LintExecutionCacheLookup(fixture.root, fixture._file_io);
		expect(() => lookup.reusable_inputs(fixture._options)).not.toThrow();
		expect(lookup.reusable_inputs(fixture._options).available).toBe(false);
	});

	test("treats malformed cached fingerprints as misses", () => {
		const fixture = new CompleteCacheFixture(new InMemoryFileIO());
		const context = new LintExecutionCacheContext(fixture.cache_context_options(new Map(), fixture._analysis_identity));
		const cache = context.lint_cache();
		cache.write({ files: [fixture._file], violations: [] });
		const cache_file = join(fixture.root, ".ai-code-guard", "cache", "lint-execution", "lint-result.json");
		const record = fixture._file_io.file(cache_file).file_text();
		fixture._file_io.file(cache_file).write_text(record.replace(/"fingerprints":\[[^\]]*\]/, '"fingerprints":[null]'));
		const lookup = new LintExecutionCacheLookup(fixture.root, fixture._file_io);
		const result = lookup.reusable_inputs(fixture._options);
		expect(result.available).toBe(false);
	});
});
