import { describe, expect, test } from "@jest/globals";
import { AstDiskCache } from "src/core/cache/ast-disk-cache/ast_disk_cache";
import { TypeScriptAstFile } from "src/model/ast/type_script_ast_file";
import { AstDiskCacheFixture } from "tests/bridge/ts/core/ast-disk-cache-fixture";
import { InMemoryFileIO } from "tests/bridge/ts/core/cache/in_memory_file_io";

describe("AstDiskCache callable identity", () => {
	test("treats a callable without identity as a cache miss", () => {
		const fixture = new AstDiskCacheFixture(new InMemoryFileIO(), "ast-cache-null-callable-identity");
		const source_file = fixture.path("module.ts");
		const source_text = "export function run(): number { return 1; }\n";
		const ast_file = new TypeScriptAstFile(source_file, source_text);
		const cache = new AstDiskCache(fixture._root, "project-a", fixture._identity, "typescript", fixture._file_io);
		cache.write(source_file, source_text, ast_file.normalized());
		const record_path = fixture.cache_record_path("typescript");
		const serialized_record = fixture._file_io.file(record_path).file_text();
		const malformed_record = JSON.stringify(JSON.parse(serialized_record), (key, value) => {
			if (key !== "identity") {
				return value;
			}
			return undefined;
		});
		fixture._file_io.file(record_path).write_text(malformed_record);

		expect(cache.content(source_file, source_text).present()).toBe(false);
	});

	test("removes a callable without identity during cleanup", () => {
		const fixture = new AstDiskCacheFixture(new InMemoryFileIO(), "ast-cache-clean-null-identity");
		const source_file = fixture.path("module.ts");
		const source_text = "export function run(): number { return 1; }\n";
		const ast_file = new TypeScriptAstFile(source_file, source_text);
		const cache = new AstDiskCache(fixture._root, "project-a", fixture._identity, "typescript", fixture._file_io);
		cache.write(source_file, source_text, ast_file.normalized());
		const record_path = fixture.cache_record_path("typescript");
		const serialized_record = fixture._file_io.file(record_path).file_text();
		const malformed_record = JSON.stringify(JSON.parse(serialized_record), (key, value) => {
			if (key !== "identity") {
				return value;
			}
			return undefined;
		});
		fixture._file_io.file(record_path).write_text(malformed_record);
		cache.clean_unused_records();

		expect(fixture._file_io.file(record_path).path_exists()).toBe(false);
	});
});
