import { describe, expect, test } from "@jest/globals";
import { AstModel } from "src/core/ast_model";
import { AstDiskCache } from "src/core/cache/ast-disk-cache/ast_disk_cache";
import { AstDiskCacheFixture } from "tests/bridge/ts/core/ast-disk-cache-fixture";
import { InMemoryFileIO } from "tests/bridge/ts/core/cache/in_memory_file_io";

describe("AstDiskCache source snapshots", () => {
	const ast_model = new AstModel("python");

	test("does not reuse an entry for a different supplied source snapshot", () => {
		const fixture = new AstDiskCacheFixture(new InMemoryFileIO(), "ast-cache-snapshot-mismatch");
		const source_file = fixture.path("module.py");
		fixture.write(source_file, "value = 1\n");
		const cache = new AstDiskCache(fixture._root, "project-a", fixture._identity, "python", fixture._file_io);
		cache.write(source_file, "value = 1\n", ast_model.empty_ast_file());

		expect(cache.content(source_file, "value = 2\n").present()).toBe(false);
	});

	test("does not reuse a cleanup-retained entry after the requested source changes", () => {
		const fixture = new AstDiskCacheFixture(new InMemoryFileIO(), "ast-cache-cleanup-snapshot-mismatch");
		const source_file = fixture.path("module.py");
		fixture.write(source_file, "value = 1\n");
		const cache = new AstDiskCache(fixture._root, "project-a", fixture._identity, "python", fixture._file_io);
		cache.write(source_file, "value = 1\n", ast_model.empty_ast_file());
		cache.clean_unused_records();

		expect(cache.content(source_file, "value = 2\n").present()).toBe(false);
	});

	test("persists the supplied snapshot without rereading changed source text", () => {
		const fixture = new AstDiskCacheFixture(new InMemoryFileIO(), "ast-cache-snapshot-update");
		const source_file = fixture.path("module.py");
		fixture.write(source_file, "value = 1\n");
		const cache = new AstDiskCache(fixture._root, "project-a", fixture._identity, "python", fixture._file_io);
		cache.write(source_file, "value = 1\n", ast_model.empty_ast_file());
		fixture.write(source_file, "value = 2\n");

		expect(cache.content(source_file, "value = 1\n").present()).toBe(true);
	});
});
