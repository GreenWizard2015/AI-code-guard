import { join } from "node:path";
import { describe, expect, test } from "@jest/globals";
import { LintExecutionCacheContext } from "src/core/cache/lint_execution_cache_context";
import { LintExecutionCacheLookup } from "src/core/cache/lint_execution_cache_lookup";
import { LintExecutionCachePreparer } from "src/core/cache/lint_execution_cache_preparer";
import { TextFileDiscovery } from "src/core/text_file_discovery";
import { ProjectAnalysisIdentity } from "src/core/project-source/project_analysis_identity";
import { InMemoryProjectSourceIO } from "src/io/in_memory_project_source_io";
import { LintStageTimer } from "src/lint_stage_timer";
import { DiagnosticRule } from "src/model/diagnostic_rule";
import type { LintInputFiles } from "src/types";
import { CompleteCacheFixture } from "tests/bridge/ts/core/complete-cache-fixture";
import { TestFixture } from "tests/core/test-fixture";

describe("complete cache result validation", () => {
	test("invalidates results after an analyzer upgrade", () => {
		const fixture = new CompleteCacheFixture();
		const marker = join(fixture.analyzer_root, "src", "analyzer.ts");
		const old_context = new LintExecutionCacheContext(
			fixture.cache_context_options(new Map(), fixture.analysis_identity),
		);
		old_context.lint_cache().write({ files: [fixture.file], violations: [] });
		fixture.file_io.file_content.write_text(marker, "export const analyzer = 2;\n");
		const new_context = new LintExecutionCacheContext(
			fixture.cache_context_options(new Map(), new ProjectAnalysisIdentity(fixture.file_io, fixture.analyzer_root)),
		);
		const result = new_context.lint_cache().cached_result();
		expect(result.available).toBe(false);
	});

	test("invalidates results after TypeScript resolution config changes", () => {
		const fixture = new CompleteCacheFixture();
		const context = new LintExecutionCacheContext(fixture.cache_context_options(new Map(), fixture.analysis_identity));
		context.lint_cache().write({ files: [fixture.file], violations: [] });
		fixture.write_source(fixture.typescript_config_file, '{"compilerOptions":{"baseUrl":"src"}}\n');
		const changed_context = new LintExecutionCacheContext(
			fixture.cache_context_options(new Map(), fixture.analysis_identity),
		);
		const result = changed_context.lint_cache().cached_result();
		expect(result.available).toBe(false);
	});

	test("uses a prepared markdown snapshot after the source changes", () => {
		const fixture = new CompleteCacheFixture();
		const discovery = new TextFileDiscovery(new DiagnosticRule("cyrillic-comment"), fixture.source_io);
		const preparer = new LintExecutionCachePreparer(
			{ input_files: () => fixture.inputs },
			fixture.file_io,
			fixture.source_io,
			fixture.analysis_identity,
		);
		const prepared = preparer.prepare_for_inputs(fixture.options, new LintStageTimer(), fixture.inputs);
		const initial = discovery.violations(fixture.root, new Set(), prepared.source_texts).length;
		fixture.write_source(fixture.markdown_file, fixture.changed_markdown_source);
		const after_change = discovery.violations(fixture.root, new Set(), prepared.source_texts).length;
		expect([initial, after_change]).toEqual([1, 1]);
	});

	test("reads cache input snapshots from the injected source provider", () => {
		const fixture = new CompleteCacheFixture();
		const source_io = new InMemoryProjectSourceIO(new Map(fixture.source_texts));
		fixture.file_io.file_operations.remove_file(fixture.file);
		const preparer = new LintExecutionCachePreparer(
			{ input_files: () => fixture.inputs },
			fixture.file_io,
			source_io,
			fixture.analysis_identity,
		);
		const prepared = preparer.prepare_for_inputs(fixture.options, new LintStageTimer(), fixture.inputs);

		expect(prepared.source_texts.get(fixture.file)).toBe(fixture.initial_source);
	});

	test("invalidates publication when an input appears during analysis", () => {
		const fixture = new CompleteCacheFixture();
		const context = new LintExecutionCacheContext(fixture.cache_context_options(new Map(), fixture.analysis_identity));
		const cache = context.lint_cache();
		fixture.write_source(join(fixture.root, "publication-window.ts"), "export const next = 2;\n");
		cache.write({ files: [fixture.file], violations: [] });
		const lookup = new LintExecutionCacheLookup(fixture.root, fixture.file_io);
		const result = lookup.reusable_inputs([], fixture.options);
		expect(result.available).toBe(false);
	});

	test("retries preparation when input discovery changes", () => {
		const fixture = new CompleteCacheFixture();
		const new_file = join(fixture.root, "discovery-drift.ts");
		let discovery_calls = 0;
		const changed_inputs: LintInputFiles = {
			...fixture.inputs,
			files: [...fixture.inputs.files, new_file],
			project_files: [...fixture.inputs.project_files, new_file],
		};
		const input_discovery = {
			input_files: (): LintInputFiles => {
				discovery_calls += 1;
				if (discovery_calls === 1) {
					fixture.write_source(new_file, "export const next = 2;\n");
				}
				return changed_inputs;
			},
		};
		const preparer = new LintExecutionCachePreparer(
			input_discovery,
			fixture.file_io,
			fixture.source_io,
			fixture.analysis_identity,
		);
		const prepared = preparer.prepare_for_inputs(fixture.options, new LintStageTimer(), fixture.inputs);
		const includes_new_file = prepared.inputs.files.includes(new_file);
		expect({ includes_new_file, discovery_calls }).toEqual({ includes_new_file: true, discovery_calls: 2 });
	});

	test("does not reuse a clean report when source changes between snapshot and fingerprint", () => {
		const fixture = new CompleteCacheFixture();
		const changed_source = "export function read(value: unknown): string { return value; }";
		let change_after_snapshot = true;
		const source_io = {
			source_available: (file: string): boolean => fixture.source_io.source_available(file),
			source_paths: (root: string, ignored: ReadonlySet<string>): readonly string[] =>
				fixture.source_io.source_paths(root, ignored),
			source_text: (file: string): string => {
				const snapshot = fixture.source_io.source_text(file);
				if (file === fixture.file && change_after_snapshot) {
					change_after_snapshot = false;
					fixture.write_source(file, changed_source);
				}
				return snapshot;
			},
		};
		const preparer = new LintExecutionCachePreparer(
			{ input_files: () => fixture.inputs },
			fixture.file_io,
			source_io,
			fixture.analysis_identity,
		);
		const prepared_snapshot = preparer.prepare_for_inputs(fixture.options, new LintStageTimer(), fixture.inputs);
		prepared_snapshot.cache.write({ files: [fixture.file], violations: [] });
		const changed_fixture = new TestFixture();
		const changed_violations = changed_fixture.collect_fixture_violations({ "module.ts": changed_source });
		const fresh_violations = changed_violations.filter((item) => item.rule_id === "unbounded-type");
		const warm_candidate = preparer.complete_cache(fixture.options, new LintStageTimer());
		const warm_result = warm_candidate.cache.cached_result();

		expect({
			snapshot_is_clean_source: prepared_snapshot.source_texts.get(fixture.file) === fixture.initial_source,
			current_source_is_changed: fixture.file_io.file_content.file_text(fixture.file) === changed_source,
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
});
