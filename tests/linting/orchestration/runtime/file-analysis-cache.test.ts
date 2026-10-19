import { join } from "node:path";
import { describe, expect, test } from "@jest/globals";
import { LintFileName } from "src/core/context/lint_file_name";
import { TypeScriptLintSourceRecord } from "src/core/context/type_script_lint_source_record";
import { InMemoryProjectSourceIO } from "src/io/in_memory_project_source_io";
import { GlobalAnalysisCache } from "src/core/support/global_analysis_cache";
import { FileAnalysisCache } from "src/linting/orchestration/runtime/file_analysis_cache";
import { TypeScriptAstFile } from "src/model/ast/type_script_ast_file";
import type { LintSourceRecord } from "src/types";
import { ViolationValue } from "src/violation_value";
import { AstDiskCacheFixture } from "tests/bridge/ts/core/ast-disk-cache-fixture";
import { FileAnalysisCacheWorkspace } from "tests/bridge/ts/runner/orchestration/runtime/file-analysis-cache-workspace";

/** Responsibilities: _in-memory analysis cache project_, _source record ownership_. **/
/** Responsibilities: _cache project preparation_, _cache record preparation_. **/
class CacheFixtureBuilder {
	/** Responsibilities: _cache fixture project writing_. **/
	private write_project(ast_project: AstDiskCacheFixture, file: string, text: string, config_file: string): void {
		ast_project.write(file, text);
		ast_project.write(config_file, '{"compilerOptions":{"baseUrl":"."}}\n');
	}

	/** Responsibilities: _cache fixture source record_. **/
	private source_record(file: string, text: string): LintSourceRecord {
		const ast_file = new TypeScriptAstFile(file, text);
		return new TypeScriptLintSourceRecord(
			{
				absolute_path: file,
				relative_path: "module.ts",
				file_name: new LintFileName("module.ts"),
				text,
				normalized_ast: ast_file.normalized(),
				source_resolver: new Map(),
			},
			ast_file,
			ast_file.traversal,
		);
	}

	/** Responsibilities: _cache fixture diagnostic_. **/
	private diagnostic(): ViolationValue {
		return new ViolationValue({
			file: "module.ts",
			line: 1,
			message: "message",
			hint: "hint",
			rule_id: "rule",
			priority: 1,
		});
	}

	/** Responsibilities: _cache fixture construction_. **/
	public create(): FileAnalysisCacheWorkspace {
		const ast_project = new AstDiskCacheFixture("file-analysis-cache");
		const file = join(ast_project.root, "module.ts");
		const text = "export const value = 1;\n";
		const config_file = join(ast_project.root, "tsconfig.json");
		this.write_project(ast_project, file, text, config_file);
		const source_texts = new Map([
			[file, text],
			[config_file, '{"compilerOptions":{"baseUrl":"."}}\n'],
		]);
		const source_io = new InMemoryProjectSourceIO(source_texts);
		const record = this.source_record(file, text);
		const violation = this.diagnostic();
		return new FileAnalysisCacheWorkspace(
			ast_project.root,
			ast_project.file_io,
			ast_project.identity,
			source_texts,
			source_io,
			record,
			violation,
		);
	}
}

describe("FileAnalysisCache", () => {
	const fixture_factory = new CacheFixtureBuilder();
	test("reuses diagnostics for unchanged source content", () => {
		const fixture = fixture_factory.create();
		const cache = new FileAnalysisCache(
			fixture.root,
			[fixture.record],
			fixture.analysis_identity,
			fixture.file_io,
			fixture.source_io,
		);
		cache.write(fixture.file, fixture.text, false, [fixture.violation]);
		const hit = cache.cached_violations(fixture.file, fixture.text, false);

		expect({ available: hit.available, details: hit.value.map((item) => item.details()) }).toEqual({
			available: true,
			details: [fixture.violation.details()],
		});
	});

	test("rejects changed source, ignored mode, and project context", () => {
		const fixture = fixture_factory.create();
		const cache = new FileAnalysisCache(
			fixture.root,
			[fixture.record],
			fixture.analysis_identity,
			fixture.file_io,
			fixture.source_io,
		);
		cache.write(fixture.file, fixture.text, false, [fixture.violation]);
		const changed = cache.cached_violations(fixture.file, "export const value = 2;\n", false);
		const ignored = cache.cached_violations(fixture.file, fixture.text, true);
		const changed_context_cache = new FileAnalysisCache(
			fixture.root,
			[{ ...fixture.record, text: "changed project context" }],
			fixture.analysis_identity,
			fixture.file_io,
			fixture.source_io,
		);
		const changed_context = changed_context_cache.cached_violations(fixture.file, fixture.text, false);

		expect({ changed: changed.available, ignored: ignored.available, context: changed_context.available }).toEqual({
			changed: false,
			ignored: false,
			context: false,
		});
	});

	test("rejects cached diagnostics after a source directory appears", () => {
		const fixture = fixture_factory.create();
		const original_cache = new FileAnalysisCache(
			fixture.root,
			[fixture.record],
			fixture.analysis_identity,
			fixture.file_io,
			fixture.source_io,
		);
		original_cache.write(fixture.file, fixture.text, false, [fixture.violation]);
		fixture.file_io.directory_operations.create_directory(join(fixture.root, "src", "widgets"));
		const refreshed_cache = new FileAnalysisCache(
			fixture.root,
			[fixture.record],
			fixture.analysis_identity,
			fixture.file_io,
			fixture.source_io,
		);

		expect(refreshed_cache.cached_violations(fixture.file, fixture.text, false).available).toBe(false);
	});

	test("invalidates file diagnostics when TypeScript path mappings change", () => {
		const fixture = fixture_factory.create();
		fixture.write_source(
			fixture.typescript_config_file,
			'{"compilerOptions":{"baseUrl":".","paths":{"alias/*":["first/*"]}}}\n',
		);
		const original_cache = new FileAnalysisCache(
			fixture.root,
			[fixture.record],
			fixture.analysis_identity,
			fixture.file_io,
			fixture.source_io,
		);
		original_cache.write(fixture.file, fixture.text, false, [fixture.violation]);
		fixture.write_source(
			fixture.typescript_config_file,
			'{"compilerOptions":{"baseUrl":".","paths":{"alias/*":["second/*"]}}}\n',
		);
		const refreshed_cache = new FileAnalysisCache(
			fixture.root,
			[fixture.record],
			fixture.analysis_identity,
			fixture.file_io,
			fixture.source_io,
		);

		expect(refreshed_cache.cached_violations(fixture.file, fixture.text, false).available).toBe(false);
	});

	test("removes cached diagnostics for deleted project files", () => {
		const fixture = fixture_factory.create();
		const cache = new FileAnalysisCache(
			fixture.root,
			[fixture.record],
			fixture.analysis_identity,
			fixture.file_io,
			fixture.source_io,
		);
		cache.write(fixture.file, fixture.text, false, []);
		cache.clean_unused_records([]);
		const cache_directory = join(fixture.root, ".ai-code-guard", "cache", "file");

		expect(fixture.file_io.directory_entries.list_files(cache_directory)).toEqual([]);
	});

	test("stores each cache kind in its own cache directory", () => {
		const fixture = fixture_factory.create();
		const file_cache = new FileAnalysisCache(
			fixture.root,
			[fixture.record],
			fixture.analysis_identity,
			fixture.file_io,
			fixture.source_io,
		);
		file_cache.write(fixture.file, fixture.text, false, []);
		const global_cache = new GlobalAnalysisCache(fixture.global_cache_options(new Set([fixture.file]), new Set(), []));
		global_cache.write([]);
		const cache_root = join(fixture.root, ".ai-code-guard", "cache");

		expect({
			file: fixture.file_io.file_paths.path_exists(join(cache_root, "file")),
			global: fixture.file_io.file_paths.path_exists(join(cache_root, "global")),
			legacy_file: fixture.file_io.file_paths.path_exists(join(fixture.root, ".ai-code-guard", "file-cache")),
			legacy_global: fixture.file_io.file_paths.path_exists(join(fixture.root, ".ai-code-guard", "global-cache")),
		}).toEqual({ file: true, global: true, legacy_file: false, legacy_global: false });
	});

	test("invalidates global diagnostics when the selection changes", () => {
		const fixture = fixture_factory.create();
		const cache = new GlobalAnalysisCache(fixture.global_cache_options(new Set([fixture.file]), new Set(), []));
		cache.write([fixture.violation]);
		const hit = cache.cached_violations();
		const changed_cache = new GlobalAnalysisCache(fixture.global_cache_options(new Set(), new Set(), []));
		const changed = changed_cache.cached_violations();

		expect({
			details: hit.value.map((item) => item.details()),
			hit: hit.available,
			changed: changed.available,
		}).toEqual({
			details: [fixture.violation.details()],
			hit: true,
			changed: false,
		});
	});

	test("invalidates global diagnostics when configured entry files change", () => {
		const fixture = fixture_factory.create();
		const cache = new GlobalAnalysisCache(fixture.global_cache_options(new Set([fixture.file]), new Set(), []));
		cache.write([fixture.violation]);
		const initial = cache.cached_violations().available;
		const changed_cache = new GlobalAnalysisCache(
			fixture.global_cache_options(new Set([fixture.file]), new Set(), ["module.ts"]),
		);
		const changed = changed_cache.cached_violations();

		expect({ initial, changed: changed.available }).toEqual({
			initial: true,
			changed: false,
		});
	});

	test("invalidates global diagnostics when TypeScript resolution changes", () => {
		const fixture = fixture_factory.create();
		const cache = new GlobalAnalysisCache(fixture.global_cache_options(new Set([fixture.file]), new Set(), []));
		cache.write([fixture.violation]);
		fixture.write_source(fixture.typescript_config_file, '{"compilerOptions":{"baseUrl":"src"}}\n');

		const changed_cache = new GlobalAnalysisCache(fixture.global_cache_options(new Set([fixture.file]), new Set(), []));
		const changed = changed_cache.cached_violations();
		expect(changed.available).toBe(false);
	});

	test("rejects malformed diagnostics in partial file and global caches", () => {
		const fixture = fixture_factory.create();
		const cache = new FileAnalysisCache(
			fixture.root,
			[fixture.record],
			fixture.analysis_identity,
			fixture.file_io,
			fixture.source_io,
		);
		cache.write(fixture.file, fixture.text, false, [fixture.violation]);
		const file_corrupted = fixture.corrupt_cache("file");
		const global_cache = new GlobalAnalysisCache(fixture.global_cache_options(new Set([fixture.file]), new Set(), []));
		global_cache.write([fixture.violation]);
		const global_corrupted = fixture.corrupt_cache("global");

		expect({
			file_corrupted,
			global_corrupted,
			file: cache.cached_violations(fixture.file, fixture.text, false).available,
			global: global_cache.cached_violations().available,
		}).toEqual({ file_corrupted: true, global_corrupted: true, file: false, global: false });
	});
});
