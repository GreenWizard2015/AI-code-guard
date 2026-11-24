import { homedir } from "node:os";
import { join } from "node:path";
import { describe, expect, test } from "@jest/globals";
import { GitIgnoredPaths } from "src/git_ignored_paths";
import { InMemoryProjectSourceIO } from "src/io/in_memory_project_source_io";

describe("gitignore path decisions", () => {
	test("preserves visible input order and duplicate paths", () => {
		const root = "/virtual/gitignore-visible-order";
		const io = new InMemoryProjectSourceIO(new Map([[join(root, ".gitignore"), "*.log\n"]]));
		const main_file = join(root, "src/main.ts");
		const ignored_paths = new GitIgnoredPaths(root, io);
		const visible_files = ignored_paths.filter([main_file, join(root, "debug.log"), main_file]);
		expect(visible_files).toEqual([main_file, main_file]);
	});

	test("returns the ignored decision for a repeated absolute path", () => {
		const root = "/virtual/gitignore-path-decision-cache";
		const candidate = join(root, "src/ignored.ts");
		const io = new InMemoryProjectSourceIO(new Map([[join(root, ".gitignore"), "src/*.ts\n"]]));
		const ignored_paths = new GitIgnoredPaths(root, io);
		const first_filter = ignored_paths.filter([candidate]);
		const repeated_filter = ignored_paths.filter([candidate]);
		expect({ first_filter, repeated_filter }).toEqual({ first_filter: [], repeated_filter: [] });
	});

	test("retains absent global and repository excludes for cache validation", () => {
		const root = "/virtual/gitignore-absent-inputs";
		const ignored_paths = new GitIgnoredPaths(root, new InMemoryProjectSourceIO(new Map()));
		ignored_paths.filter([join(root, "sample.ts")]);
		expect(ignored_paths.configuration_files()).toEqual(
			[
				join(homedir(), ".gitignore_global"),
				join(homedir(), ".config", "git", "ignore"),
				join(root, ".git", "info", "exclude"),
				join(root, ".gitignore"),
			].sort(),
		);
	});

	test("filters distinct sibling files according to their path rules", () => {
		const root = "/virtual/gitignore-directory-decision-cache";
		const io = new InMemoryProjectSourceIO(new Map([[join(root, ".gitignore"), "src/*.ignored\n"]]));
		const first_file = join(root, "src/first.ts");
		const second_file = join(root, "src/second.ts");
		const ignored_paths = new GitIgnoredPaths(root, io);
		const first_visible_files = ignored_paths.filter([first_file]);
		const second_visible_files = ignored_paths.filter([second_file]);
		expect({ first_visible_files, second_visible_files }).toEqual({
			first_visible_files: [first_file],
			second_visible_files: [second_file],
		});
	});
});
