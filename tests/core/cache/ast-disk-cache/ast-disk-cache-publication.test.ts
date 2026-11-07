import { join } from "node:path";
import { describe, expect, test } from "@jest/globals";
import { AstModel } from "src/core/ast_model";
import { AstDiskCache } from "src/core/cache/ast-disk-cache/ast_disk_cache";
import { AstDiskCacheFixture } from "tests/bridge/ts/core/ast-disk-cache-fixture";
import { InMemoryFileIO } from "tests/bridge/ts/core/cache/in_memory_file_io";
import { IntermittentMoveFileIO } from "tests/bridge/ts/core/cache/intermittent_move_file_io";

describe("AstDiskCache publication", () => {
	test("publishes one record for a successful write", () => {
		const fixture = new AstDiskCacheFixture(new InMemoryFileIO(), "ast-cache-single-record");
		const ast_model = new AstModel("python");
		const source_file = fixture.path("module.py");
		fixture.write(source_file, "value = 1\n");
		const cache = new AstDiskCache(fixture._root, "project-a", fixture._identity, "typescript", fixture._file_io);
		cache.write(source_file, "value = 1\n", ast_model.empty_ast_file());
		const cache_directory = join(fixture._root, ".ai-code-guard", "cache", "ast", "typescript");

		expect(fixture._file_io.list_files(cache_directory)).toHaveLength(1);
	});

	test("does not publish a record after a failed write", () => {
		const fixture = new AstDiskCacheFixture(new InMemoryFileIO(), "ast-cache-failed-publication");
		const file_io = new IntermittentMoveFileIO(1);
		const source_file = fixture.path("module.py");
		const cache = new AstDiskCache(fixture._root, "project-a", fixture._identity, "python", file_io);
		const cache_directory = join(fixture._root, ".ai-code-guard", "cache", "ast", "python");
		const ast_model = new AstModel("python");
		const ast = ast_model.empty_ast_file();
		cache.write(source_file, "value = 1\n", ast);

		expect({
			available: cache.content(source_file, "value = 1\n").present(),
			records: file_io.list_files(cache_directory),
		}).toEqual({
			available: false,
			records: [],
		});
	});

	test("publishes one clean record when retrying after a failed write", () => {
		const fixture = new AstDiskCacheFixture(new InMemoryFileIO(), "ast-cache-publication-retry");
		const file_io = new IntermittentMoveFileIO(1);
		const source_file = fixture.path("module.py");
		const cache = new AstDiskCache(fixture._root, "project-a", fixture._identity, "python", file_io);
		const cache_directory = join(fixture._root, ".ai-code-guard", "cache", "ast", "python");
		const ast_model = new AstModel("python");
		const ast = ast_model.empty_ast_file();

		cache.write(source_file, "value = 1\n", ast);
		const missing_after_failure = cache.content(source_file, "value = 1\n").present();
		cache.write(source_file, "value = 1\n", ast);

		expect({
			missing_after_failure,
			available_after_retry: cache.content(source_file, "value = 1\n").present(),
			records: file_io.list_files(cache_directory),
		}).toEqual({
			missing_after_failure: false,
			available_after_retry: true,
			records: [expect.stringMatching(/\.json$/u)],
		});
	});
});
