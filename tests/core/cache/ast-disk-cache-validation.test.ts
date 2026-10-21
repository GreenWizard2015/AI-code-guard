import { join } from "node:path";
import { describe, expect, test } from "@jest/globals";
import { AstModel } from "src/core/ast_model";
import { AstDiskCache } from "src/core/cache/ast_disk_cache";
import { TypeScriptAstFile } from "src/model/ast/type_script_ast_file";
import { AstDiskCacheFixture } from "tests/bridge/ts/core/ast-disk-cache-fixture";

describe("AstDiskCache record validation", () => {
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

	test("rejects cached fields without an explicit class-scope state", () => {
		const fixture = new AstDiskCacheFixture("ast-cache-missing-class-scope");
		const source_file = fixture.path("module.ts");
		const source_text = "class Example { value: string; }\n";
		fixture.write(source_file, source_text);
		const ast_file = new TypeScriptAstFile(source_file, source_text);
		const ast = ast_file.normalized();
		const cache = new AstDiskCache(fixture.root, "project-a", fixture.identity, "typescript", fixture.file_io);
		cache.write(source_file, source_text, ast);
		const cache_directory = join(fixture.root, ".ai-code-guard", "cache", "ast", "typescript");
		const path = fixture.only_file(cache_directory);
		const record = JSON.parse(fixture.file_io.file_content.file_text(path));
		delete record.ast.classes[0].fields[0].class_scope;
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

	test("treats malformed nested type-member records as a cache miss", () => {
		const fixture = new AstDiskCacheFixture("ast-cache-invalid-type-members");
		const source_file = fixture.path("module.ts");
		const source_text = "export type Example = string;\n";
		fixture.write(source_file, source_text);
		const cache = new AstDiskCache(fixture.root, "project-a", fixture.identity, "typescript", fixture.file_io);
		const ast_model = new AstModel();
		const empty_ast = ast_model.empty_ast_file("typescript");
		cache.write(source_file, source_text, empty_ast);
		const cache_directory = join(fixture.root, ".ai-code-guard", "cache", "ast", "typescript");
		const path = fixture.only_file(cache_directory);
		const record = JSON.parse(fixture.file_io.file_content.file_text(path));
		record.ast.type_members = null;
		fixture.file_io.file_content.write_text(path, JSON.stringify(record));

		expect(cache.content(source_file, source_text).present()).toBe(false);
	});

	test("removes a structurally invalid AST cache record during cleanup", () => {
		const fixture = new AstDiskCacheFixture("ast-cache-null-cleanup-record");
		const cache_directory = join(fixture.root, ".ai-code-guard", "cache", "ast", "python");
		fixture.file_io.directory_operations.create_directory(cache_directory);
		fixture.file_io.file_content.write_text(join(cache_directory, "invalid.json"), "null");
		const cache = new AstDiskCache(fixture.root, "project-a", fixture.identity, "python", fixture.file_io);

		cache.clean_unused_records();

		expect(fixture.file_io.directory_entries.list_files(cache_directory)).toEqual([]);
	});
});
