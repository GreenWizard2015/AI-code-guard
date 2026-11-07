import { describe, expect, test } from "@jest/globals";
import { PYTHON_PROJECT_CONFIGURATION_FILE, TYPESCRIPT_CONFIG_FILE } from "src/constants";
import { ProjectSourceSnapshot } from "src/core/cache/project_source_snapshot";
import { InMemoryProjectSourceIO } from "src/io/in_memory_project_source_io";

describe("in-memory project source snapshots", () => {
	test("collects source and documentation text from the supplied memory snapshot", () => {
		const source_io = new InMemoryProjectSourceIO(
			new Map([
				["/virtual/project/src/main.ts", "export class Main {}"],
				["/virtual/project/docs/guide.md", "Project guide"],
			]),
		);
		const snapshot = new ProjectSourceSnapshot("/virtual/project", source_io);

		expect(
			Object.fromEntries(
				snapshot.source_texts({
					files: ["/virtual/project/src/main.ts"],
					project_files: ["/virtual/project/src/main.ts"],
					ignored_files: [],
					markdown_files: ["/virtual/project/docs/guide.md"],
					ignore_files: [],
				}),
			),
		).toEqual({
			"/virtual/project/src/main.ts": "export class Main {}",
			"/virtual/project/docs/guide.md": "Project guide",
		});
	});

	test("deduplicates paths shared by source and markdown input groups", () => {
		const snapshot = new ProjectSourceSnapshot(
			"/virtual/project",
			new InMemoryProjectSourceIO(new Map([["/virtual/project/src/main.ts", "export class Main {}"]])),
		);

		expect(
			snapshot.source_paths({
				files: [],
				project_files: ["/virtual/project/src/main.ts"],
				ignored_files: [],
				markdown_files: ["/virtual/project/src/main.ts"],
				ignore_files: [],
			}),
		).toEqual(["/virtual/project/src/main.ts"]);
	});

	test("captures runtime source text once for cache identity and later analysis", () => {
		const root = "/virtual/runtime-snapshot";
		const runtime_file = `${root}/worker.mjs`;
		const source_values = new Map([[runtime_file, 'export { run } from "./first.js";']]);
		const source_io = new InMemoryProjectSourceIO(source_values);
		const snapshot = new ProjectSourceSnapshot(root, source_io);
		const texts = snapshot.source_texts({
			files: [],
			project_files: [],
			ignored_files: [],
			markdown_files: [],
			ignore_files: [],
		});
		source_values.set(runtime_file, 'export { run } from "./second.js";');

		expect({ captured_path: texts.has(runtime_file), captured_text: texts.get(runtime_file) }).toEqual({
			captured_path: true,
			captured_text: 'export { run } from "./first.js";',
		});
	});

	test("reports membership separately from the in-memory source value", () => {
		const source_io = new InMemoryProjectSourceIO(
			new Map([
				["/virtual/project/src/main.ts", "export class Main {}"],
				["/virtual/project/node_modules/pkg/index.ts", "export class External {}"],
				["/virtual/other/src/other.ts", "export class Other {}"],
			]),
		);
		const snapshot = new ProjectSourceSnapshot("/virtual/project", source_io);

		expect({
			present: source_io.source_available("/virtual/project/src/main.ts"),
			missing: source_io.source_available("/virtual/project/src/missing.ts"),
			missing_text: source_io.source_text("/virtual/project/src/missing.ts"),
			supplied_paths: source_io.source_paths("", new Set()),
			project_inventory: source_io.source_paths("/virtual/project", new Set()),
			filtered_inventory: source_io.source_paths("/virtual/project", new Set(["node_modules"])),
			project_paths: snapshot.source_paths({
				files: [],
				project_files: ["/virtual/project/src/main.ts"],
				ignored_files: [],
				markdown_files: [],
				ignore_files: [],
			}),
		}).toEqual({
			present: true,
			missing: false,
			missing_text: "",
			supplied_paths: [
				"/virtual/project/src/main.ts",
				"/virtual/project/node_modules/pkg/index.ts",
				"/virtual/other/src/other.ts",
			],
			project_inventory: ["/virtual/project/src/main.ts", "/virtual/project/node_modules/pkg/index.ts"],
			filtered_inventory: ["/virtual/project/src/main.ts"],
			project_paths: ["/virtual/project/src/main.ts"],
		});
	});
	test("captures transitive compiler configuration and Python project metadata", () => {
		const root = "/virtual/configuration-snapshot";
		const source_file = `${root}/src/main.ts`;
		const config_file = `${root}/${TYPESCRIPT_CONFIG_FILE}`;
		const base_config = `${root}/base.json`;
		const python_config = `${root}/${PYTHON_PROJECT_CONFIGURATION_FILE}`;
		const source_io = new InMemoryProjectSourceIO(
			new Map([
				[source_file, "export const value = 1;"],
				[config_file, '{"extends":"./base.json"}'],
				[base_config, '{"compilerOptions":{"baseUrl":"src"}}'],
				[python_config, "[tool.pytest.ini_options]"],
			]),
		);
		const snapshot = new ProjectSourceSnapshot(root, source_io);
		const texts = snapshot.source_texts({
			files: [source_file],
			project_files: [source_file],
			ignored_files: [],
			markdown_files: [],
			ignore_files: [],
		});

		const files = [...texts.keys()];
		files.sort();
		expect({
			files,
			base_config: texts.get(base_config),
			python_config: texts.get(python_config),
		}).toEqual({
			files: [base_config, config_file, python_config, source_file].sort(),
			base_config: '{"compilerOptions":{"baseUrl":"src"}}',
			python_config: "[tool.pytest.ini_options]",
		});
	});
});
