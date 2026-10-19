import { join } from "node:path";
import { describe, expect, test } from "@jest/globals";
import { AstModel } from "src/core/ast_model";
import { AstDiskCache } from "src/core/cache/ast_disk_cache";
import { ProjectAnalysisIdentity } from "src/core/project-source/project_analysis_identity";
import { AstDiskCacheFixture } from "tests/bridge/ts/core/ast-disk-cache-fixture";

describe("AstDiskCache", () => {
	test("stores the analyzer identity in the cache record", () => {
		const fixture = new AstDiskCacheFixture("ast-cache-analyzer-record");
		const ast_model = new AstModel();
		const source_file = fixture.path("module.py");
		fixture.write(source_file, "value = 1\n");
		const identity = fixture.identity;
		const cache = new AstDiskCache(fixture.root, "project-a", identity, "typescript", fixture.file_io);
		cache.write(source_file, "value = 1\n", ast_model.empty_ast_file("python"));
		const cache_directory = join(fixture.root, ".ai-code-guard", "cache", "ast", "typescript");
		const cache_file = fixture.only_file(cache_directory);
		const record = JSON.parse(fixture.file_io.file_content.file_text(cache_file));

		expect(record.project_identity).toContain(identity.analyzer());
	});

	test("changes analyzer identity after an implementation update", () => {
		const fixture = new AstDiskCacheFixture("ast-cache-analyzer-upgrade");
		const previous_identity = fixture.identity.analyzer();
		fixture.write(join(fixture.analyzer_root, "src/rules.ts"), "export const version = 2;\n");
		const new_identity = new ProjectAnalysisIdentity(fixture.file_io, fixture.analyzer_root);

		expect(new_identity.analyzer()).not.toBe(previous_identity);
	});

	test("rejects a cache entry after an analyzer implementation update", () => {
		const fixture = new AstDiskCacheFixture("ast-cache-analyzer-cache-upgrade");
		const source_file = fixture.path("module.ts");
		const source_text = "export const value = 1;\n";
		const ast_model = new AstModel();
		const empty_ast = ast_model.empty_ast_file("typescript");
		fixture.write(source_file, source_text);
		const cache = new AstDiskCache(fixture.root, "project-a", fixture.identity, "typescript", fixture.file_io);
		cache.write(source_file, source_text, empty_ast);
		fixture.write(join(fixture.analyzer_root, "src/rules.ts"), "export const version = 2;\n");
		const identity = new ProjectAnalysisIdentity(fixture.file_io, fixture.analyzer_root);
		const updated_cache = new AstDiskCache(fixture.root, "project-a", identity, "typescript", fixture.file_io);

		expect(updated_cache.content(source_file, source_text).present()).toBe(false);
	});

	test("invalidates stale entries after source content changes", () => {
		const fixture = new AstDiskCacheFixture("ast-cache-stale-source");
		const ast_model = new AstModel();
		const source_file = fixture.path("module.py");
		fixture.write(source_file, "value = 1\n");
		const cache = new AstDiskCache(fixture.root, "project-a", fixture.identity, "python", fixture.file_io);
		cache.write(source_file, "value = 1\n", ast_model.empty_ast_file("python"));

		expect(cache.content(source_file, "value = 2\n").present()).toBe(false);
	});

	test("removes cache entries for deleted source files at startup", () => {
		const fixture = new AstDiskCacheFixture("ast-cache-deleted-source");
		const ast_model = new AstModel();
		const source_file = fixture.path("module.py");
		fixture.write(source_file, "value = 1\n");
		const cache = new AstDiskCache(fixture.root, "project-a", fixture.identity, "python", fixture.file_io);
		cache.write(source_file, "value = 1\n", ast_model.empty_ast_file("python"));
		fixture.file_io.file_operations.remove_file(source_file);
		cache.clean_unused_records();
		const cache_directory = join(fixture.root, ".ai-code-guard", "cache", "ast", "python");

		expect(fixture.file_io.directory_entries.list_files(cache_directory)).toEqual([]);
	});

	test("stores normalized TypeScript AST values", () => {
		const fixture = new AstDiskCacheFixture("ast-cache-typescript-value");
		const ast_model = new AstModel();
		const source_file = fixture.path("module.ts");
		const source_text = "export const value = 1;\n";
		fixture.write(source_file, source_text);
		const ast = ast_model.empty_ast_file("typescript");
		const cache = new AstDiskCache(fixture.root, "project-a", fixture.identity, "typescript", fixture.file_io);
		cache.write(source_file, source_text, ast);

		expect(cache.content(source_file, source_text).value()).toEqual(ast);
	});

	test("rejects a cache entry with an invalid nested class declaration", () => {
		const fixture = new AstDiskCacheFixture("ast-cache-invalid-class");
		const ast_model = new AstModel();
		const source_file = fixture.path("module.py");
		const source_text = "value = 1\n";
		fixture.write(source_file, source_text);
		const cache = new AstDiskCache(fixture.root, "project-a", fixture.identity, "python", fixture.file_io);
		cache.write(source_file, source_text, ast_model.empty_ast_file("python"));
		const cache_directory = join(fixture.root, ".ai-code-guard", "cache", "ast", "python");
		const path = fixture.only_file(cache_directory);
		const record = JSON.parse(fixture.file_io.file_content.file_text(path));
		record.ast.classes = [null];
		fixture.file_io.file_content.write_text(path, JSON.stringify(record));

		expect(cache.content(source_file, source_text).present()).toBe(false);
	});

	test("rejects a cache entry with an invalid nested type declaration", () => {
		const fixture = new AstDiskCacheFixture("ast-cache-invalid-type");
		const ast_model = new AstModel();
		const source_file = fixture.path("module.py");
		const source_text = "value = 1\n";
		fixture.write(source_file, source_text);
		const cache = new AstDiskCache(fixture.root, "project-a", fixture.identity, "python", fixture.file_io);
		cache.write(source_file, source_text, ast_model.empty_ast_file("python"));
		const cache_directory = join(fixture.root, ".ai-code-guard", "cache", "ast", "python");
		const path = fixture.only_file(cache_directory);
		const record = JSON.parse(fixture.file_io.file_content.file_text(path));
		record.ast.type_declarations = [null];
		fixture.file_io.file_content.write_text(path, JSON.stringify(record));

		expect(cache.content(source_file, source_text).present()).toBe(false);
	});
});
