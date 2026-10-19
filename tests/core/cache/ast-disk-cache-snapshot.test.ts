import { describe, expect, test } from "@jest/globals";
import { AstModel } from "src/core/ast_model";
import { AstDiskCache } from "src/core/cache/ast_disk_cache";
import { AstDiskCacheFixture } from "tests/bridge/ts/core/ast-disk-cache-fixture";

describe("AstDiskCache source snapshots", () => {
	const ast_model = new AstModel();

	test("does not reuse an entry for a different supplied source snapshot", () => {
		const fixture = new AstDiskCacheFixture("ast-cache-snapshot-mismatch");
		const source_file = fixture.path("module.py");
		fixture.write(source_file, "value = 1\n");
		const cache = new AstDiskCache(fixture.root, "project-a", fixture.identity, "python", fixture.file_io);
		cache.write(source_file, "value = 1\n", ast_model.empty_ast_file("python"));

		expect(cache.content(source_file, "value = 2\n").present()).toBe(false);
	});

	test("persists the supplied snapshot without rereading changed source text", () => {
		const fixture = new AstDiskCacheFixture("ast-cache-snapshot-update");
		const source_file = fixture.path("module.py");
		fixture.write(source_file, "value = 1\n");
		const cache = new AstDiskCache(fixture.root, "project-a", fixture.identity, "python", fixture.file_io);
		cache.write(source_file, "value = 1\n", ast_model.empty_ast_file("python"));
		fixture.write(source_file, "value = 2\n");

		expect(cache.content(source_file, "value = 1\n").present()).toBe(true);
	});
});
