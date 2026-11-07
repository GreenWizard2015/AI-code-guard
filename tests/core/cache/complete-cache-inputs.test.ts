import { describe, expect, test } from "@jest/globals";
import { LintExecutionCacheContext } from "src/core/cache/lint_execution_cache_context";
import { LintExecutionCacheLookup } from "src/core/cache/lint_execution_cache_lookup";
import { ProjectSourceSnapshot } from "src/core/cache/project_source_snapshot";
import { ProjectTextSnapshot } from "src/core/project_text_snapshot";
import { LintStageTimer } from "src/lint_stage_timer";
import type { CliOptions } from "src/task_types";
import { InMemoryFileIO } from "tests/bridge/ts/core/cache/in_memory_file_io";
import { CompleteCacheFixture } from "tests/bridge/ts/core/complete-cache-fixture";

describe("complete cache input validation", () => {
	test("reuses unchanged inputs", () => {
		const fixture = new CompleteCacheFixture(new InMemoryFileIO());
		const context = new LintExecutionCacheContext(fixture.cache_context_options(new Map(), fixture._analysis_identity));
		const cache = context.lint_cache();
		cache.write({ files: [fixture._file], violations: [] });
		const lookup = new LintExecutionCacheLookup(fixture.root, fixture._file_io);
		const result = lookup.reusable_inputs(fixture._options);
		expect({ available: result.available, inputs: result.value }).toEqual({ available: true, inputs: fixture._inputs });
	});

	test("invalidates input reuse when entry files change", () => {
		const fixture = new CompleteCacheFixture(new InMemoryFileIO());
		const context = new LintExecutionCacheContext(fixture.cache_context_options(new Map(), fixture._analysis_identity));
		context.lint_cache().write({ files: [fixture._file], violations: [] });
		const options: CliOptions = { ...fixture._options, entry_files: [fixture._file] };
		const lookup = new LintExecutionCacheLookup(fixture.root, fixture._file_io);
		const result = lookup.reusable_inputs(options);
		expect(result.available).toBe(false);
	});

	test("invalidates input reuse when ignore files change", () => {
		const fixture = new CompleteCacheFixture(new InMemoryFileIO());
		const context = new LintExecutionCacheContext(fixture.cache_context_options(new Map(), fixture._analysis_identity));
		context.lint_cache().write({ files: [fixture._file], violations: [] });
		fixture.write_source(fixture._ignore_file, "coverage/\nlogs/\n");
		const lookup = new LintExecutionCacheLookup(fixture.root, fixture._file_io);
		const result = lookup.reusable_inputs(fixture._options);
		expect(result.available).toBe(false);
	});
	test("reuses unchanged absent ignore inputs and invalidates when one appears", () => {
		const fixture = new CompleteCacheFixture(new InMemoryFileIO());
		const absent_global_ignore = "/virtual/user/.gitignore_global";
		const inputs = { ...fixture._inputs, ignore_files: [...fixture._inputs.ignore_files, absent_global_ignore] };
		const initial = new LintExecutionCacheContext({
			...fixture.cache_context_options(new Map(), fixture._analysis_identity),
			inputs,
		});
		initial.lint_cache().write({ files: [fixture._file], violations: [] });
		const lookup = new LintExecutionCacheLookup(fixture.root, fixture._file_io);
		const unchanged = lookup.reusable_inputs(fixture._options);
		fixture.write_source(absent_global_ignore, "module.ts\n");
		const present = lookup.reusable_inputs(fixture._options);

		expect({ unchanged: unchanged.available, invalidated_after_creation: present.available }).toEqual({
			unchanged: true,
			invalidated_after_creation: false,
		});
	});
	test("uses one captured compiler configuration for cache identity and analysis", () => {
		const fixture = new CompleteCacheFixture(new InMemoryFileIO());
		const snapshot = new ProjectSourceSnapshot(fixture.root, fixture._source_io);
		const captured_texts = snapshot.source_texts(fixture._inputs);
		const captured_cache = new LintExecutionCacheContext(
			fixture.cache_context_options(captured_texts, fixture._analysis_identity),
		);
		const captured_state = captured_cache.cache_state();
		fixture.write_source(fixture._typescript_config_file, '{"compilerOptions":{"baseUrl":".","paths":{"@x":["a"]}}}\n');
		const current_texts = snapshot.source_texts(fixture._inputs);
		const current_cache = new LintExecutionCacheContext(
			fixture.cache_context_options(current_texts, fixture._analysis_identity),
		);
		const current_state = current_cache.cache_state();
		const text_snapshot = new ProjectTextSnapshot({
			repo_root: fixture.root,
			files: [fixture._file],
			ignore_files: [],
			provided_texts: captured_texts,
			configuration_snapshot_complete: true,
			stage_timer: new LintStageTimer(),
			virtual_project: false,
			source_io: fixture._source_io,
		});
		const analyzed_texts = text_snapshot.project_texts();

		expect({
			analysis_uses_captured_configuration: analyzed_texts.get(fixture._typescript_config_file),
			captured_config_is_fingerprinted: captured_state.fingerprints.some(
				(fingerprint) => fingerprint.file === fixture._typescript_config_file,
			),
			cache_identity_changes_for_updated_configuration: captured_state.identity !== current_state.identity,
		}).toEqual({
			analysis_uses_captured_configuration: '{"compilerOptions":{"baseUrl":"."}}\n',
			captured_config_is_fingerprinted: true,
			cache_identity_changes_for_updated_configuration: true,
		});
	});

	test("invalidates input reuse when a nested directory appears", () => {
		const fixture = new CompleteCacheFixture(new InMemoryFileIO());
		const context = new LintExecutionCacheContext(fixture.cache_context_options(new Map(), fixture._analysis_identity));
		context.lint_cache().write({ files: [fixture._file], violations: [] });
		fixture.create_nested_input();
		const lookup = new LintExecutionCacheLookup(fixture.root, fixture._file_io);
		const result = lookup.reusable_inputs(fixture._options);
		expect(result.available).toBe(false);
	});
});
