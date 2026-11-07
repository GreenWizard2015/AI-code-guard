import { join } from "node:path";
import { describe, expect, test } from "@jest/globals";
import { AstModel } from "src/core/ast_model";
import { AstDiskCache } from "src/core/cache/ast-disk-cache/ast_disk_cache";
import { AST_ANALYSIS_CACHE_VERSION } from "src/core/constants";
import { TypeScriptAstFile } from "src/model/ast/type_script_ast_file";
import { AstDiskCacheFixture } from "tests/bridge/ts/core/ast-disk-cache-fixture";
import { InMemoryFileIO } from "tests/bridge/ts/core/cache/in_memory_file_io";

describe("AstDiskCache record validation", () => {
	test("keeps a valid AST cache record during cleanup", () => {
		const fixture = new AstDiskCacheFixture(new InMemoryFileIO(), "ast-cache-valid-cleanup-record");
		const source_file = fixture.path("module.py");
		const source_text = "value = 1\n";
		const ast_model = new AstModel("python");
		const normalized_ast = ast_model.empty_ast_file();
		const cache = fixture.cache_for(source_file, source_text, "python", normalized_ast);
		const cache_directory = join(fixture._root, ".ai-code-guard", "cache", "ast", "python");

		cache.clean_unused_records();

		expect({
			cached_records: fixture._file_io.list_files(cache_directory).length,
			cache_entry_present: cache.content(source_file, source_text).present(),
		}).toEqual({ cached_records: 1, cache_entry_present: true });
	});

	test("removes cached AST records from an older schema version", () => {
		const fixture = new AstDiskCacheFixture(new InMemoryFileIO(), "ast-cache-old-schema");
		const source_file = fixture.path("module.py");
		const source_text = "value = 1\n";
		const ast_model = new AstModel("python");
		const normalized_ast = ast_model.empty_ast_file();
		const cache = fixture.cache_for(source_file, source_text, "python", normalized_ast);
		const path = fixture.cache_record_path("python");
		const stored_record = fixture._file_io.file(path).file_text();
		const stale_record = stored_record.replace(
			`"cache_version":${AST_ANALYSIS_CACHE_VERSION}`,
			`"cache_version":${AST_ANALYSIS_CACHE_VERSION - 1}`,
		);
		fixture._file_io.file(path).write_text(stale_record);

		cache.clean_unused_records();

		expect(fixture._file_io.list_files(join(fixture._root, ".ai-code-guard", "cache", "ast", "python"))).toEqual([]);
	});

	test("rejects a cache entry with an invalid nested class declaration", () => {
		const fixture = new AstDiskCacheFixture(new InMemoryFileIO(), "ast-cache-invalid-class");
		const source_file = fixture.path("module.py");
		const source_text = "value = 1\n";
		const ast_model = new AstModel("python");
		const normalized_ast = ast_model.empty_ast_file();
		const cache = fixture.cache_for(source_file, source_text, "python", normalized_ast);
		const path = fixture.cache_record_path("python");
		const stored_record = fixture._file_io.file(path).file_text();
		const malformed_record = stored_record.replace('"classes":[]', '"classes":[null]');
		fixture._file_io.file(path).write_text(malformed_record);

		expect(cache.content(source_file, source_text).present()).toBe(false);
	});

	test("rejects cached fields without an explicit class-scope state", () => {
		const fixture = new AstDiskCacheFixture(new InMemoryFileIO(), "ast-cache-missing-class-scope");
		const source_file = fixture.path("module.ts");
		const source_text = "class Example { value: string; }\n";
		const ast_file = new TypeScriptAstFile(source_file, source_text);
		const ast = ast_file.normalized();
		const cache = fixture.cache_for(source_file, source_text, "typescript", ast);
		const path = fixture.cache_record_path("typescript");
		const stored_record = fixture._file_io.file(path).file_text();
		const malformed_record = stored_record.replace(/,"class_scope":(?:true|false)/u, "");
		fixture._file_io.file(path).write_text(malformed_record);

		expect(cache.content(source_file, source_text).present()).toBe(false);
	});

	test("rejects a cache entry with an invalid nested type declaration", () => {
		const fixture = new AstDiskCacheFixture(new InMemoryFileIO(), "ast-cache-invalid-type");
		const source_file = fixture.path("module.py");
		const source_text = "value = 1\n";
		const ast_model = new AstModel("python");
		const normalized_ast = ast_model.empty_ast_file();
		const cache = fixture.cache_for(source_file, source_text, "python", normalized_ast);
		const path = fixture.cache_record_path("python");
		const stored_record = fixture._file_io.file(path).file_text();
		const malformed_record = stored_record.replace('"type_declarations":[]', '"type_declarations":[null]');
		fixture._file_io.file(path).write_text(malformed_record);

		expect(cache.content(source_file, source_text).present()).toBe(false);
	});

	test("treats malformed nested type-member records as a cache miss", () => {
		const fixture = new AstDiskCacheFixture(new InMemoryFileIO(), "ast-cache-invalid-type-members");
		const source_file = fixture.path("module.ts");
		const source_text = "export type Example = string;\n";
		const ast_model = new AstModel("typescript");
		const normalized_ast = ast_model.empty_ast_file();
		const cache = fixture.cache_for(source_file, source_text, "typescript", normalized_ast);
		const path = fixture.cache_record_path("typescript");
		const stored_record = fixture._file_io.file(path).file_text();
		const malformed_record = stored_record.replace('"type_members":[]', '"type_members":null');
		fixture._file_io.file(path).write_text(malformed_record);

		expect(cache.content(source_file, source_text).present()).toBe(false);
	});

	test("removes a structurally invalid AST cache record during cleanup", () => {
		const fixture = new AstDiskCacheFixture(new InMemoryFileIO(), "ast-cache-null-cleanup-record");
		const cache_directory = join(fixture._root, ".ai-code-guard", "cache", "ast", "python");
		fixture._file_io.create_directory(cache_directory);
		fixture._file_io.file(join(cache_directory, "invalid.json")).write_text("null");
		const cache = new AstDiskCache(fixture._root, "project-a", fixture._identity, "python", fixture._file_io);

		cache.clean_unused_records();

		expect(fixture._file_io.list_files(cache_directory)).toEqual([]);
	});
});
