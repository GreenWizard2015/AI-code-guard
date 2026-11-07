import { describe, expect, test } from "@jest/globals";
import { ProjectRuntimeSourcePaths } from "src/core/project-source/project_runtime_source_paths";
import { InMemoryProjectSourceIO } from "src/io/in_memory_project_source_io";

describe("project runtime source paths", () => {
	test("keeps runtime extensions and excludes source files", () => {
		const runtime_file = "/virtual/project/runtime.js";
		const config_file = "/virtual/project/package.json";
		const source_io = new InMemoryProjectSourceIO(
			new Map([
				[runtime_file, ""],
				[config_file, ""],
				["/virtual/project/source.ts", ""],
			]),
		);
		const source_paths = new ProjectRuntimeSourcePaths("/virtual/project", source_io);

		expect(source_paths.source_paths()).toEqual([runtime_file, config_file]);
	});

	test("appends only runtime paths absent from the existing inventory", () => {
		const existing_file = "/virtual/project/runtime.js";
		const new_file = "/virtual/project/worker.mjs";
		const source_io = new InMemoryProjectSourceIO(
			new Map([
				[existing_file, ""],
				[new_file, ""],
				["/virtual/project/source.ts", ""],
			]),
		);
		const source_paths = new ProjectRuntimeSourcePaths("/virtual/project", source_io);
		const paths = new Set<string>();

		source_paths.append_to(paths, new Set([existing_file]));

		expect([...paths]).toEqual([new_file]);
	});
});
