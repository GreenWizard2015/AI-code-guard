import { describe, expect, test } from "@jest/globals";
import { LintFileDiscovery } from "src/core/lint_file_discovery";
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
		const discovery = new LintFileDiscovery(source_io);
		const files = discovery.walk_files_raw(root, root, new Set());

		expect(files).toEqual([`${root}/src/service.ts`, `${root}/src/worker.py`]);
	});

	test("excludes files below explicitly ignored directories", () => {
		const root = "/virtual/project";
		const ignored_directory = `${root}/src/generated`;
		const source_io = new InMemoryProjectSourceIO(
			new Map([
				[`${root}/src/service.ts`, "export class Service {}"],
				[`${ignored_directory}/generated.ts`, "export class Generated {}"],
			]),
		);
		const discovery = new LintFileDiscovery(source_io);
		const files = discovery.walk_files_raw(root, root, new Set([ignored_directory]));

		expect(files).toEqual([`${root}/src/service.ts`]);
	});
});
