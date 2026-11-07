import { join } from "node:path";
import { describe, expect, test } from "@jest/globals";
import { CacheDirectoryTree } from "src/core/cache/cache_directory_tree";
import { InMemoryFileIO } from "tests/bridge/ts/core/cache/in_memory_file_io";
import { DirectoryListingFileIO } from "tests/core/cache/directory-listing-file-io";

describe("cache directory tree", () => {
	test("discovers source directories and skips ignored directory names", () => {
		const root = "/virtual/cache-project";
		const file_io = new InMemoryFileIO();
		file_io.seed_files(
			new Map([
				[join(root, "src", "service.ts"), "export class Service {}"],
				[join(root, "node_modules", "vendor", "index.js"), ""],
			]),
		);
		const tree = new CacheDirectoryTree(root, file_io);
		const directory_names = [...tree.directory_names()];
		directory_names.sort();

		expect(directory_names).toEqual([root, join(root, "src")].sort());
	});

	test("fingerprints sorted directory entries and their kinds", () => {
		const root = "/virtual/cache-fingerprint";
		const source_file = join(root, "src", "service.ts");
		const file_io = new InMemoryFileIO();
		file_io.seed_files(new Map([[source_file, "export class Service {}"]]));
		const tree = new CacheDirectoryTree(root, file_io);
		const fingerprints = tree.fingerprints([source_file]);

		expect(fingerprints.map((fingerprint) => [fingerprint.directory, fingerprint.entries])).toEqual([
			[root, ["src\u0000directory"]],
			[join(root, "src"), ["service.ts\u0000file"]],
		]);
	});

	test("reuses directory entries collected during traversal", () => {
		const root = "/virtual/cache-directory-snapshot";
		const file_io = new DirectoryListingFileIO();
		const source_file = join(root, "src", "service.ts");
		file_io.seed_files(new Map([[source_file, "export class Service {}"]]));
		const tree = new CacheDirectoryTree(root, file_io);

		const fingerprints = tree.fingerprints([source_file]);
		const listed_directories = Array.from(file_io.listed_directories());
		listed_directories.sort();

		expect({
			fingerprint_directories: fingerprints.map((fingerprint) => fingerprint.directory).sort(),
			listed_directories,
		}).toEqual({
			fingerprint_directories: [root, join(root, "src")].sort(),
			listed_directories: [root, join(root, "src")].sort(),
		});
	});
});
