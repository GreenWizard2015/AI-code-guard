import { delimiter, join } from "node:path";
import { describe, expect, test } from "@jest/globals";
import { ProjectRuntimeSourcePaths } from "src/core/project-source/project_runtime_source_paths";
import { InMemoryProjectSourceIO } from "src/io/in_memory_project_source_io";
import { ProjectAnalysisIdentity } from "src/project_analysis_identity";
import { InMemoryAnalyzerProject } from "tests/core/project-source/in-memory-analyzer-project";

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

	test("uses the first available Python runtime in search-path order", () => {
		const project = new InMemoryAnalyzerProject();
		const first_directory = join(project.root, "runtime-one");
		const second_directory = join(project.root, "runtime-two");
		project._file_io.create_directory(first_directory);
		project._file_io.create_directory(second_directory);
		project._file_io.file(join(first_directory, "python3")).write_text("first runtime");
		project._file_io.file(join(second_directory, "python3")).write_text("second runtime");
		const first_runtime_first = new ProjectAnalysisIdentity(
			project._file_io,
			project.root,
			[first_directory, second_directory].join(delimiter),
		);
		const second_runtime_first = new ProjectAnalysisIdentity(
			project._file_io,
			project.root,
			[second_directory, first_directory].join(delimiter),
		);

		expect(first_runtime_first.analyzer()).not.toBe(second_runtime_first.analyzer());
	});
});
