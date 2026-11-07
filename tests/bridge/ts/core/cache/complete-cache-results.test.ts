import { join } from "node:path";
import { describe, expect, test } from "@jest/globals";
import { LintExecutionCacheContext } from "src/core/cache/lint_execution_cache_context";
import { LintExecutionCacheLookup } from "src/core/cache/lint_execution_cache_lookup";
import { LintExecutionCachePreparer } from "src/core/cache/lint_execution_cache_preparer";
import { TextFileDiscovery } from "src/core/discovery/text_file_discovery";
import { ProjectAnalysisIdentity } from "src/core/project-source/project_analysis_identity";
import { InMemoryProjectSourceIO } from "src/io/in_memory_project_source_io";
import { LintStageTimer } from "src/lint_stage_timer";
import type { LintInputFiles } from "src/project_analysis_types";
import { InMemoryFileIO } from "tests/bridge/ts/core/cache/in_memory_file_io";
import { CompleteCacheFixture } from "tests/bridge/ts/core/complete-cache-fixture";
import { TestFixture } from "tests/core/test-fixture";

describe("complete cache result validation", () => {
	test("invalidates results after an analyzer upgrade", () => {
		const fixture = new CompleteCacheFixture(new InMemoryFileIO());
		const marker = join(fixture.analyzer_root, "src", "analyzer.ts");
		const old_context = new LintExecutionCacheContext(
			fixture.cache_context_options(new Map(), fixture._analysis_identity),
		);
		const old_cache = old_context.lint_cache();
		old_cache.write({ files: [fixture._file], violations: [] });
		fixture._file_io.file(marker).write_text("export const analyzer = 2;\n");
		const new_context = new LintExecutionCacheContext(
			fixture.cache_context_options(new Map(), new ProjectAnalysisIdentity(fixture._file_io, fixture.analyzer_root)),
		);
		const new_cache = new_context.lint_cache();
		const result = new_cache.cached_result();
		expect(result.available).toBe(false);
	});

	test("invalidates results after TypeScript resolution config changes", () => {
		const fixture = new CompleteCacheFixture(new InMemoryFileIO());
		const context = new LintExecutionCacheContext(fixture.cache_context_options(new Map(), fixture._analysis_identity));
		const cache = context.lint_cache();
		cache.write({ files: [fixture._file], violations: [] });
		fixture.write_source(fixture._typescript_config_file, '{"compilerOptions":{"baseUrl":"src"}}\n');
		const changed_context = new LintExecutionCacheContext(
			fixture.cache_context_options(new Map(), fixture._analysis_identity),
		);
		const changed_cache = changed_context.lint_cache();
		const result = changed_cache.cached_result();
		expect(result.available).toBe(false);
	});

	test("uses a prepared markdown snapshot after the source changes", () => {
		const fixture = new CompleteCacheFixture(new InMemoryFileIO());
		const discovery = new TextFileDiscovery(fixture._source_io);
		const preparer = new LintExecutionCachePreparer({
			options: fixture._options,
			stage_timer: new LintStageTimer(),
			lint_input_discovery: { input_files: (): LintInputFiles => fixture._inputs },
			file_io: fixture._file_io,
			source_io: fixture._source_io,
			analysis_identity: fixture._analysis_identity,
		});
		const prepared = preparer.prepare_for_inputs(fixture._inputs);
		const project = discovery.for_project(fixture.root, new Set());
		const initial = project.violations(prepared.source_texts).length;
		fixture.write_source(fixture._markdown_file, fixture.changed_markdown_source);
		const after_change = project.violations(prepared.source_texts).length;
		expect([initial, after_change]).toEqual([1, 1]);
	});

	test("reads cache input snapshots from the injected source provider", () => {
		const fixture = new CompleteCacheFixture(new InMemoryFileIO());
		const source_io = new InMemoryProjectSourceIO(new Map(fixture._source_texts));
		fixture._file_io.file(fixture._file).remove_file();
		const preparer = new LintExecutionCachePreparer({
			options: fixture._options,
			stage_timer: new LintStageTimer(),
			lint_input_discovery: { input_files: (): LintInputFiles => fixture._inputs },
			file_io: fixture._file_io,
			source_io,
			analysis_identity: fixture._analysis_identity,
		});
		const prepared = preparer.prepare_for_inputs(fixture._inputs);

		expect(prepared.source_texts.get(fixture._file)).toBe(fixture.initial_source);
	});

	test("invalidates publication when an input appears during analysis", () => {
		const fixture = new CompleteCacheFixture(new InMemoryFileIO());
		const context = new LintExecutionCacheContext(fixture.cache_context_options(new Map(), fixture._analysis_identity));
		const cache = context.lint_cache();
		fixture.write_source(join(fixture.root, "publication-window.ts"), "export const next = 2;\n");
		cache.write({ files: [fixture._file], violations: [] });
		const lookup = new LintExecutionCacheLookup(fixture.root, fixture._file_io);
		const result = lookup.reusable_inputs(fixture._options);
		expect(result.available).toBe(false);
	});

	test("keeps metadata-only cache candidates from taking a duplicate source snapshot", () => {
		const fixture = new CompleteCacheFixture(new InMemoryFileIO());
		let source_file_reads = 0;
		const source_io = {
			source_available: (file: string): boolean => fixture._source_io.source_available(file),
			source_paths: (root: string, ignored: ReadonlySet<string>): readonly string[] =>
				fixture._source_io.source_paths(root, ignored),
			source_text: (file: string): string => {
				if (file === fixture._file) {
					source_file_reads += 1;
				}
				return fixture._source_io.source_text(file);
			},
		};
		const preparer = new LintExecutionCachePreparer({
			options: fixture._options,
			stage_timer: new LintStageTimer(),
			lint_input_discovery: { input_files: (): LintInputFiles => fixture._inputs },
			file_io: fixture._file_io,
			source_io,
			analysis_identity: fixture._analysis_identity,
		});
		const full_snapshot = preparer.prepare_for_inputs(fixture._inputs);
		full_snapshot.cache.write({ files: [fixture._file], violations: [] });
		source_file_reads = 0;
		const cache_candidate = preparer.complete_cache();

		expect({
			snapshot_complete: cache_candidate.snapshot_complete,
			cached_source_texts: cache_candidate.source_texts.size,
			reads_before_cache_miss_preparation: source_file_reads,
		}).toEqual({ snapshot_complete: false, cached_source_texts: 0, reads_before_cache_miss_preparation: 0 });
	});

	test("does not reuse a clean report when source changes between snapshot and fingerprint", () => {
		const fixture = new CompleteCacheFixture(new InMemoryFileIO());
		const changed_source = "export function read(value: unknown): string { return value; }";
		let change_after_snapshot = true;
		const source_io = {
			source_available: (file: string): boolean => fixture._source_io.source_available(file),
			source_paths: (root: string, ignored: ReadonlySet<string>): readonly string[] =>
				fixture._source_io.source_paths(root, ignored),
			source_text: (file: string): string => {
				const snapshot = fixture._source_io.source_text(file);
				if (file === fixture._file && change_after_snapshot) {
					change_after_snapshot = false;
					fixture.write_source(file, changed_source);
				}
				return snapshot;
			},
		};
		const preparer = new LintExecutionCachePreparer({
			options: fixture._options,
			stage_timer: new LintStageTimer(),
			lint_input_discovery: { input_files: (): LintInputFiles => fixture._inputs },
			file_io: fixture._file_io,
			source_io,
			analysis_identity: fixture._analysis_identity,
		});
		const prepared_snapshot = preparer.prepare_for_inputs(fixture._inputs);
		prepared_snapshot.cache.write({ files: [fixture._file], violations: [] });
		const changed_fixture = new TestFixture();
		const changed_violations = changed_fixture.collect_fixture_violations({ "module.ts": changed_source });
		const fresh_violations = changed_violations.filter((item) => item.rule_id() === "unbounded-type");
		const warm_candidate = preparer.complete_cache();
		const warm_result = warm_candidate.cache.cached_result();

		expect({
			snapshot_is_clean_source: prepared_snapshot.source_texts.get(fixture._file) === fixture.initial_source,
			current_source_is_changed: fixture._file_io.file(fixture._file).file_text() === changed_source,
			changed_source_has_real_diagnostic: fresh_violations.length > 0,
			warm_result_available: warm_result.available,
			stale_result_is_clean: warm_result.available && warm_result.value.violations.length === 0,
		}).toEqual({
			snapshot_is_clean_source: true,
			current_source_is_changed: true,
			changed_source_has_real_diagnostic: true,
			warm_result_available: false,
			stale_result_is_clean: false,
		});
	});

	test("reuses the complete cache for unchanged CRLF source files", () => {
		const fixture = new CompleteCacheFixture(new InMemoryFileIO());
		const raw_source = "export const value = 1;\r\n";
		const normalized_source = "export const value = 1;\n";
		fixture.write_source(fixture._file, raw_source);
		const source_texts = new Map(fixture._source_texts);
		source_texts.set(fixture._file, normalized_source);
		const first_context = new LintExecutionCacheContext(
			fixture.cache_context_options(source_texts, fixture._analysis_identity),
		);
		const first_cache = first_context.lint_cache();
		first_cache.write({ files: [fixture._file], violations: [] });
		const second_context = new LintExecutionCacheContext(
			fixture.cache_context_options(new Map(), fixture._analysis_identity),
		);

		const second_cache = second_context.lint_cache();
		const second_result = second_cache.cached_result();
		expect({ available: second_result.available }).toEqual({ available: true });
	});
});
