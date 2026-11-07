import { join } from "node:path";
import { describe, expect, test } from "@jest/globals";
import { AstModel } from "src/core/ast_model";
import { AstDiskCache } from "src/core/cache/ast-disk-cache/ast_disk_cache";
import { ProjectAnalysisIdentity } from "src/core/project-source/project_analysis_identity";
import { AstDiskCacheFixture } from "tests/bridge/ts/core/ast-disk-cache-fixture";
import { InMemoryFileIO } from "tests/bridge/ts/core/cache/in_memory_file_io";

describe("AstDiskCache", () => {
	test("stores the analyzer identity in the cache record", () => {
		const fixture = new AstDiskCacheFixture(new InMemoryFileIO(), "ast-cache-analyzer-record");
		const ast_model = new AstModel("python");
		const source_file = fixture.path("module.py");
		fixture.write(source_file, "value = 1\n");
		const identity = fixture._identity;
		const cache = new AstDiskCache(fixture._root, "project-a", identity, "typescript", fixture._file_io);
		cache.write(source_file, "value = 1\n", ast_model.empty_ast_file());
		const cache_directory = join(fixture._root, ".ai-code-guard", "cache", "ast", "typescript");
		const cache_file = fixture.only_file(cache_directory);
		const record = JSON.parse(fixture._file_io.file(cache_file).file_text());

		expect(record.project_identity).toContain(identity.analyzer());
	});

	test("changes analyzer identity after an implementation update", () => {
		const fixture = new AstDiskCacheFixture(new InMemoryFileIO(), "ast-cache-analyzer-upgrade");
		const previous_identity = fixture._identity.analyzer();
		fixture.write(join(fixture._analyzer_root, "src/rules.ts"), "export const version = 2;\n");
		const new_identity = new ProjectAnalysisIdentity(fixture._file_io, fixture._analyzer_root);

		expect(new_identity.analyzer()).not.toBe(previous_identity);
	});

	test("rejects a cache entry after an analyzer implementation update", () => {
		const fixture = new AstDiskCacheFixture(new InMemoryFileIO(), "ast-cache-analyzer-cache-upgrade");
		const source_file = fixture.path("module.ts");
		const source_text = "export const value = 1;\n";
		const ast_model = new AstModel("typescript");
		const empty_ast = ast_model.empty_ast_file();
		fixture.write(source_file, source_text);
		const cache = new AstDiskCache(fixture._root, "project-a", fixture._identity, "typescript", fixture._file_io);
		cache.write(source_file, source_text, empty_ast);
		fixture.write(join(fixture._analyzer_root, "src/rules.ts"), "export const version = 2;\n");
		const identity = new ProjectAnalysisIdentity(fixture._file_io, fixture._analyzer_root);
		const updated_cache = new AstDiskCache(fixture._root, "project-a", identity, "typescript", fixture._file_io);

		expect(updated_cache.content(source_file, source_text).present()).toBe(false);
	});

	test("invalidates stale entries after source content changes", () => {
		const fixture = new AstDiskCacheFixture(new InMemoryFileIO(), "ast-cache-stale-source");
		const ast_model = new AstModel("python");
		const source_file = fixture.path("module.py");
		fixture.write(source_file, "value = 1\n");
		const cache = new AstDiskCache(fixture._root, "project-a", fixture._identity, "python", fixture._file_io);
		cache.write(source_file, "value = 1\n", ast_model.empty_ast_file());

		expect(cache.content(source_file, "value = 2\n").present()).toBe(false);
	});

	test("removes cache entries for deleted source files at startup", () => {
		const fixture = new AstDiskCacheFixture(new InMemoryFileIO(), "ast-cache-deleted-source");
		const ast_model = new AstModel("python");
		const source_file = fixture.path("module.py");
		fixture.write(source_file, "value = 1\n");
		const cache = new AstDiskCache(fixture._root, "project-a", fixture._identity, "python", fixture._file_io);
		cache.write(source_file, "value = 1\n", ast_model.empty_ast_file());
		fixture._file_io.file(source_file).remove_file();
		cache.clean_unused_records();
		const cache_directory = join(fixture._root, ".ai-code-guard", "cache", "ast", "python");

		expect(fixture._file_io.list_files(cache_directory)).toEqual([]);
	});

	test("stores normalized TypeScript AST values", () => {
		const fixture = new AstDiskCacheFixture(new InMemoryFileIO(), "ast-cache-typescript-value");
		const ast_model = new AstModel("typescript");
		const source_file = fixture.path("module.ts");
		const source_text = "export const value = 1;\n";
		fixture.write(source_file, source_text);
		const ast = ast_model.empty_ast_file();
		const cache = new AstDiskCache(fixture._root, "project-a", fixture._identity, "typescript", fixture._file_io);
		cache.write(source_file, source_text, ast);

		expect(cache.content(source_file, source_text).value()).toEqual(ast);
	});
});
