import { describe, expect, test } from "@jest/globals";
import { ProjectSourceSnapshot } from "src/core/cache/project_source_snapshot";
import { LintProjectContextCreator } from "src/core/lint_project_context_creator";
import { PythonAstBridge } from "src/core/python_ast_bridge";
import { PythonAstData } from "src/core/python_ast_data";
import { ProjectAnalysisIdentity } from "src/core/project-source/project_analysis_identity";
import { TypeScriptProjectResolution } from "src/module-resolution/type_script_project_resolution";
import { TypeScriptModuleExports } from "src/module-resolution/type_script_module_exports";
import { LintStageTimer } from "src/lint_stage_timer";
import { NodeFileIO } from "src/io/node_file_io";
import { InMemoryProjectSourceIO } from "src/io/in_memory_project_source_io";
import { TestFixture } from "tests/core/test-fixture";

describe("in-memory project source snapshots", () => {
	test("collects source and documentation text from the supplied memory snapshot", () => {
		const source_io = new InMemoryProjectSourceIO(
			new Map([
				["/virtual/project/src/main.ts", "export class Main {}"],
				["/virtual/project/docs/guide.md", "Project guide"],
			]),
		);
		const snapshot = new ProjectSourceSnapshot(source_io);

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

	test("reports membership separately from the in-memory source value", () => {
		const source_io = new InMemoryProjectSourceIO(
			new Map([
				["/virtual/project/src/main.ts", "export class Main {}"],
				["/virtual/project/node_modules/pkg/index.ts", "export class External {}"],
				["/virtual/other/src/other.ts", "export class Other {}"],
			]),
		);
		const snapshot = new ProjectSourceSnapshot(source_io);

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

	test("builds a project context from the injected IO contract without disk files", () => {
		const file = "/virtual/project/src/main.ts";
		const source_io = new InMemoryProjectSourceIO(new Map([[file, "export const value = 1;\n"]]));
		const bridge = new PythonAstBridge();
		let source_text = "";
		try {
			const context_factory = new LintProjectContextCreator(
				new PythonAstData(bridge),
				new ProjectAnalysisIdentity(new NodeFileIO()),
				source_io,
				new NodeFileIO(),
			);
			const context = context_factory.lint_context("/virtual/project", [file], new LintStageTimer(), new Map(), true);
			source_text = context.source_record(file).text;
		} finally {
			bridge.worker.close();
		}
		expect(source_text).toBe("export const value = 1;\n");
	});

	test("fills missing entries in a partial source overlay from the source provider", () => {
		const root = "/virtual/partial-source-overlay";
		const selected_file = `${root}/src/selected.ts`;
		const missing_file = `${root}/src/missing.ts`;
		const source_io = new InMemoryProjectSourceIO(
			new Map([
				[selected_file, "export const selected = 1;\n"],
				[missing_file, "export const recovered = 2;\n"],
			]),
		);
		const bridge = new PythonAstBridge();
		let recovered_text = "";
		try {
			const context_factory = new LintProjectContextCreator(
				new PythonAstData(bridge),
				new ProjectAnalysisIdentity(new NodeFileIO()),
				source_io,
				new NodeFileIO(),
			);
			const context = context_factory.lint_context(
				root,
				[selected_file, missing_file],
				new LintStageTimer(),
				new Map([[selected_file, "export const selected = 10;\n"]]),
			);
			recovered_text = context.source_record(missing_file).text;
		} finally {
			bridge.worker.close();
		}
		expect(recovered_text).toBe("export const recovered = 2;\n");
	});

	test("keeps project TypeScript path configuration available to context consumers", () => {
		let mapped_bases: readonly string[] = [];
		let expected_base = "";
		const fixture = new TestFixture();
		fixture.with_in_memory_project(
			{
				"tsconfig.json": '{"compilerOptions":{"baseUrl":".","paths":{"@domain/*":["src/domain/*"]}}}',
				"src/caller.ts": 'import { Model } from "@domain/model";',
				"src/domain/model.ts": "export class Model {}",
			},
			(root, context) => {
				const project_resolution = new TypeScriptProjectResolution(root, context.source_io);
				const resolution = project_resolution.resolution();
				mapped_bases = resolution.mapped_bases("@domain/model");
				expected_base = `${root}/src/domain/model`;
			},
			new Map(),
		);
		expect(mapped_bases).toContain(expected_base);
	});

	test("uses a supplied path configuration override in project module resolution", () => {
		let target_file = "";
		const fixture = new TestFixture();
		fixture.with_in_memory_project(
			{
				"tsconfig.json": '{"compilerOptions":{"baseUrl":".","paths":{"@target":["src/first.ts"]}}}',
				"src/caller.ts": 'import { execute } from "@target"; execute();',
				"src/first.ts": "export function execute(): void {}",
				"src/second.ts": "export function execute(): void {}",
			},
			(root, context) => {
				const caller_file = `${root}/src/caller.ts`;
				const source_files = fixture.typescript_source_files(context);
				const module_exports = new TypeScriptModuleExports(root, source_files, false, context.source_io);
				target_file = module_exports.module_symbol(caller_file, "@target");
			},
			new Map([["tsconfig.json", '{"compilerOptions":{"baseUrl":".","paths":{"@target":["src/second.ts"]}}}']]),
		);
		expect(target_file).toContain("second.ts");
	});
});
