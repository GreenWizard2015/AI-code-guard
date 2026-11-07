import { describe, expect, test } from "@jest/globals";
import { IGNORED_DIRS } from "src/constants";
import { LintFileDiscovery } from "src/core/discovery/lint_file_discovery";
import { GitIgnoredPaths } from "src/git_ignored_paths";
import { InMemoryProjectSourceIO } from "src/io/in_memory_project_source_io";

describe("source path discovery", () => {
	test("returns only supported source files from the project snapshot", () => {
		const root = "/virtual/project";
		const source_io = new InMemoryProjectSourceIO(
			new Map([
				[`${root}/src/service.ts`, "export class Service {}"],
				[`${root}/src/worker.py`, "class Worker: pass"],
				[`${root}/README.md`, "project documentation"],
			]),
		);
		const discovery = new LintFileDiscovery(root, new Set(), source_io, new GitIgnoredPaths(root, source_io));
		const files = discovery.walk_files_from(source_io.source_paths(root, IGNORED_DIRS));

		expect(files).toEqual([`${root}/src/service.ts`, `${root}/src/worker.py`]);
	});

	test("excludes files below explicitly ignored directories", () => {
		const root = "/virtual/project";
		const ignored_directory = `${root}/src/generated`;
		const source_io = new InMemoryProjectSourceIO(
			new Map([
				[`${root}/src/service.ts`, "export class Service {}"],
				[`${ignored_directory}/nested/deep/generated.ts`, "export class Generated {}"],
			]),
		);
		const discovery = new LintFileDiscovery(
			root,
			new Set([ignored_directory]),
			source_io,
			new GitIgnoredPaths(root, source_io),
		);
		const files = discovery.walk_files_from(source_io.source_paths(root, IGNORED_DIRS));

		expect(files).toEqual([`${root}/src/service.ts`]);
	});

	test("rejects paths outside the repository before checking ignored ancestors", () => {
		const root = "/virtual/project-boundary";
		const source_io = new InMemoryProjectSourceIO(new Map());
		const discovery = new LintFileDiscovery(root, new Set(), source_io, new GitIgnoredPaths(root, source_io));
		const outside = "/virtual/another-project/src/service.ts";

		expect(discovery.walk_files_from([outside])).toEqual([]);
	});
});
