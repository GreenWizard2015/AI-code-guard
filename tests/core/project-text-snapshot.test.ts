import { describe, expect, test } from "@jest/globals";
import { PYTHON_PROJECT_CONFIGURATION_FILE, TYPESCRIPT_CONFIG_FILE } from "src/constants";
import { LintProjectContextCreator } from "src/core/lint_project_context_creator";
import { ProjectAnalysisIdentity } from "src/core/project-source/project_analysis_identity";
import { ProjectTextSnapshot } from "src/core/project_text_snapshot";
import { PythonAstBridge } from "src/core/python-ast/python_ast_bridge";
import { PythonAstData } from "src/core/python-ast/python_ast_data";
import { InMemoryProjectSourceIO } from "src/io/in_memory_project_source_io";
import { NodeFileIO } from "src/io/node_file_io";
import { LintStageTimer } from "src/lint_stage_timer";
import { TypeScriptModuleExportsContext } from "src/module-resolution/exports/type_script_module_exports_context";
import { TypeScriptProjectResolution } from "src/module-resolution/project-resolution/type_script_project_resolution";
import { TestFixture } from "tests/core/test-fixture";

describe("project text snapshots", () => {
	test("builds a complete virtual text snapshot from supplied files and configuration", () => {
		const root = "/virtual/text-snapshot-builder";
		const file = `${root}/src/main.ts`;
		const typescript_config = `${root}/${TYPESCRIPT_CONFIG_FILE}`;
		const python_config = `${root}/${PYTHON_PROJECT_CONFIGURATION_FILE}`;
		const source_io = new InMemoryProjectSourceIO(
			new Map([
				[file, "live source"],
				[typescript_config, '{"compilerOptions":{}}'],
				[python_config, "[tool.pytest.ini_options]"],
			]),
		);
		const snapshot = new ProjectTextSnapshot({
			repo_root: root,
			files: [file],
			ignore_files: [],
			provided_texts: new Map([[file, "provided source"]]),
			configuration_snapshot_complete: false,
			stage_timer: new LintStageTimer(),
			virtual_project: true,
			source_io,
		});
		const texts = snapshot.project_texts();

		expect({
			source: texts.get(file),
			typescript_config: texts.get(typescript_config),
			python_config: texts.get(python_config),
			runtime_paths: snapshot.runtime_paths(texts),
		}).toEqual({
			source: "provided source",
			typescript_config: '{"compilerOptions":{}}',
			python_config: "[tool.pytest.ini_options]",
			runtime_paths: [],
		});
	});

	test("discovers runtime paths by extension and omits texts already in the snapshot", () => {
		const root = "/virtual/runtime-paths";
		const javascript_file = `${root}/runtime.js`;
		const typescript_file = `${root}/source.ts`;
		const json_file = `${root}/settings.json`;
		const source_io = new InMemoryProjectSourceIO(
			new Map([
				[javascript_file, "runtime"],
				[typescript_file, "source"],
				[json_file, "{}"],
			]),
		);
		const snapshot = new ProjectTextSnapshot({
			repo_root: root,
			files: [],
			ignore_files: [],
			provided_texts: new Map(),
			configuration_snapshot_complete: false,
			stage_timer: new LintStageTimer(),
			virtual_project: false,
			source_io,
		});

		expect(snapshot.runtime_paths(new Map([[javascript_file, "already loaded"]]))).toEqual([json_file]);
	});

	test("uses injected runtime inventory with partial text and a nonexistent disk root", () => {
		const root = "/virtual/nonexistent-runtime-root";
		const selected_file = `${root}/src/main.ts`;
		const runtime_file = `${root}/src/runtime.js`;
		const source_io = new InMemoryProjectSourceIO(
			new Map([
				[selected_file, 'import "./runtime.js";'],
				[runtime_file, "export const ready = true;"],
			]),
		);
		const snapshot = new ProjectTextSnapshot({
			repo_root: root,
			files: [selected_file],
			ignore_files: [],
			provided_texts: new Map([[selected_file, 'import "./runtime.js";']]),
			configuration_snapshot_complete: false,
			stage_timer: new LintStageTimer(),
			virtual_project: false,
			source_io,
		});

		expect(snapshot.runtime_paths(new Map([[selected_file, 'import "./runtime.js";']]))).toEqual([runtime_file]);
	});

	test("builds a project context from the injected IOContract contract without disk files", () => {
		const file = "/virtual/project/src/main.ts";
		const source_io = new InMemoryProjectSourceIO(new Map([[file, "export const value = 1;\n"]]));
		const bridge = new PythonAstBridge();
		let source_text = "";
		try {
			const context_factory = new LintProjectContextCreator(
				new PythonAstData(bridge.options()),
				new ProjectAnalysisIdentity(new NodeFileIO(process.cwd())),
				source_io,
				new NodeFileIO(process.cwd()),
			);
			const context = context_factory.lint_context(
				context_factory.snapshot({
					repo_root: "/virtual/project",
					project_files: [file],
					ignore_files: [],
					stage_timer: new LintStageTimer(),
					source_texts: new Map(),
					in_memory: true,
					configuration_snapshot_complete: false,
				}),
			);
			source_text = context.source_record(file).text;
		} finally {
			bridge._worker.close();
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
				new PythonAstData(bridge.options()),
				new ProjectAnalysisIdentity(new NodeFileIO(process.cwd())),
				source_io,
				new NodeFileIO(process.cwd()),
			);
			const context = context_factory.lint_context(
				context_factory.snapshot({
					repo_root: root,
					project_files: [selected_file, missing_file],
					ignore_files: [],
					stage_timer: new LintStageTimer(),
					source_texts: new Map([[selected_file, "export const selected = 10;\n"]]),
					in_memory: false,
					configuration_snapshot_complete: false,
				}),
			);
			recovered_text = context.source_record(missing_file).text;
		} finally {
			bridge._worker.close();
		}
		expect(recovered_text).toBe("export const recovered = 2;\n");
	});

	test("keeps project TypeScript path configuration available to context consumers", () => {
		let mapped_bases: readonly string[] = [];
		let expected_base = "";
		const fixture = new TestFixture();
		fixture._project_source.with_in_memory_project(
			{
				"tsconfig.json": '{"compilerOptions":{"baseUrl":".","paths":{"@domain/*":["src/domain/*"]}}}',
				"src/caller.ts": 'import { Model } from "@domain/model";',
				"src/domain/model.ts": "export class Model {}",
			},
			({ root, context }) => {
				const project_resolution = new TypeScriptProjectResolution(root, context.source_io());
				const resolution = project_resolution.resolution();
				mapped_bases = resolution.non_relative_bases("@domain/model");
				expected_base = `${root}/src/domain/model`;
			},
			new Map(),
		);
		expect(mapped_bases).toContain(expected_base);
	});

	test("uses a supplied path configuration override in project module resolution", () => {
		let target_file = "";
		const fixture = new TestFixture();
		fixture._project_source.with_in_memory_project(
			{
				"tsconfig.json": '{"compilerOptions":{"baseUrl":".","paths":{"@target":["src/first.ts"]}}}',
				"src/caller.ts": 'import { execute } from "@target"; execute();',
				"src/first.ts": "export function execute(): void {}",
				"src/second.ts": "export function execute(): void {}",
			},
			({ root, context }) => {
				const caller_file = `${root}/src/caller.ts`;
				const source_files = fixture._project_source.typescript_source_files(context);
				const exports_context = new TypeScriptModuleExportsContext(root, source_files, false, context.source_io());
				const module_exports = exports_context.module_exports();
				target_file = module_exports.module_symbol(caller_file, "@target");
			},
			new Map([["tsconfig.json", '{"compilerOptions":{"baseUrl":".","paths":{"@target":["src/second.ts"]}}}']]),
		);
		expect(target_file).toContain("second.ts");
	});
});
