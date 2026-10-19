import { join, relative } from "node:path";
import { GitIgnoredPaths } from "src/git_ignored_paths";
import { InMemoryProjectSourceIO } from "src/io/in_memory_project_source_io";

describe("gitignore parser", () => {
	test("supports globs, directory patterns, and negations", () => {
		const root = "/virtual/gitignore-project";
		const io = new InMemoryProjectSourceIO(new Map([[join(root, ".gitignore"), "*.log\nbuild/\n!important.log\n"]]));
		const files = ["debug.log", "important.log", "src/main.ts", "build/generated.ts"].map((file) => join(root, file));
		const ignored_paths = new GitIgnoredPaths(root, io);
		const visible_files = ignored_paths.filter(files);
		const result = visible_files.map((file) => relative(root, file));

		expect(result).toEqual(["important.log", "src/main.ts"]);
	});

	test("applies nested ignore files to their descendants", () => {
		const root = "/virtual/gitignore-nested-project";
		const io = new InMemoryProjectSourceIO(
			new Map([
				[join(root, ".gitignore"), "*.tmp\n"],
				[join(root, "src/.gitignore"), "generated/\n"],
			]),
		);
		const files = ["src/main.ts", "src/generated.ts", "src/generated/out.ts", "src/generated/keep.tmp"].map((file) =>
			join(root, file),
		);
		const ignored_paths = new GitIgnoredPaths(root, io);
		const visible_files = ignored_paths.filter(files);
		const result = visible_files.map((file) => relative(root, file));

		expect(result).toEqual(["src/main.ts", "src/generated.ts"]);
	});

	test("keeps a nested directory visible for a root-anchored pattern", () => {
		const root = "/virtual/gitignore-anchored-project";
		const io = new InMemoryProjectSourceIO(new Map([[join(root, ".gitignore"), "/generated/\n"]]));
		const files = ["generated/root.ts", "src/generated/nested.ts"].map((file) => join(root, file));
		const ignored_paths = new GitIgnoredPaths(root, io);
		const visible_files = ignored_paths.filter(files);
		const result = visible_files.map((file) => relative(root, file));

		expect(result).toEqual(["src/generated/nested.ts"]);
	});

	test("does not re-include a file while its parent directory remains ignored", () => {
		const root = "/virtual/gitignore-excluded-parent";
		const io = new InMemoryProjectSourceIO(new Map([[join(root, ".gitignore"), "build/\n!build/keep.ts\n"]]));
		const candidate = join(root, "build/keep.ts");
		const ignored_paths = new GitIgnoredPaths(root, io);
		const visible_files = ignored_paths.filter([candidate]);

		expect(visible_files).toEqual([]);
	});

	test("allows a child after an ignored parent is explicitly re-included", () => {
		const root = "/virtual/gitignore-reincluded-parent";
		const io = new InMemoryProjectSourceIO(new Map([[join(root, ".gitignore"), "build/\n!build/\n!build/keep.ts\n"]]));
		const candidate = join(root, "build/keep.ts");
		const ignored_paths = new GitIgnoredPaths(root, io);
		const visible_files = ignored_paths.filter([candidate]);

		expect(visible_files).toEqual([candidate]);
	});

	test("treats a slashless root-anchored pattern as a directory exclusion", () => {
		const root = "/virtual/gitignore-anchored-slashless";
		const io = new InMemoryProjectSourceIO(new Map([[join(root, ".gitignore"), "/build\n"]]));
		const candidate = join(root, "build/generated.ts");
		const ignored_paths = new GitIgnoredPaths(root, io);
		const visible_files = ignored_paths.filter([candidate]);

		expect(visible_files).toEqual([]);
	});

	test("preserves escaped leading punctuation and negated character classes", () => {
		const root = "/virtual/gitignore-escaped-patterns";
		const io = new InMemoryProjectSourceIO(
			new Map([[join(root, ".gitignore"), "\\!generated.ts\ngenerated[!0-9].ts\n"]]),
		);
		const files = [join(root, "!generated.ts"), join(root, "generatedx.ts")];
		const ignored_paths = new GitIgnoredPaths(root, io);
		const visible_files = ignored_paths.filter(files);

		expect(visible_files).toEqual([]);
	});

	test("treats dot-prefixed names beginning with two dots as project paths", () => {
		const root = "/virtual/gitignore-dot-prefix";
		const io = new InMemoryProjectSourceIO(new Map([[join(root, ".gitignore"), "*.ts\n"]]));
		const candidate = join(root, "..generated.ts");
		const ignored_paths = new GitIgnoredPaths(root, io);
		const visible_files = ignored_paths.filter([candidate]);

		expect(visible_files).toEqual([]);
	});
});
