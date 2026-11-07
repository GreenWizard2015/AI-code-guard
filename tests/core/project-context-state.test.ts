import { describe, expect, test } from "@jest/globals";
import { TYPESCRIPT_CONFIG_FILE } from "src/constants";
import { LintProjectContextCreator } from "src/core/lint_project_context_creator";
import { ProjectAnalysisIdentity } from "src/core/project-source/project_analysis_identity";
import { UnusedCode } from "src/core/project-source/unused_code";
import { InMemoryProjectSourceIO } from "src/io/in_memory_project_source_io";
import { TypeScriptProjectResolution } from "src/module-resolution/project-resolution/type_script_project_resolution";
import { InMemoryFileIO } from "tests/bridge/ts/core/cache/in_memory_file_io";
import { TestFixture } from "tests/core/test-fixture";

describe("coding lint project context", () => {
	test("reuses prepared TypeScript source files for source records", () => {
		const test_fixture = new TestFixture();
		const root = "/virtual/prepared-source";
		const file = `${root}/source.ts`;
		const file_io = new InMemoryFileIO();
		const context_factory = new LintProjectContextCreator(
			test_fixture.python_ast_data(),
			new ProjectAnalysisIdentity(file_io),
			new InMemoryProjectSourceIO(new Map()),
			file_io,
		);
		const context = context_factory.lint_context(
			context_factory.snapshot({
				repo_root: root,
				project_files: [file],
				ignore_files: [],
				stage_timer: test_fixture.stage_timer(),
				source_texts: new Map([[file, "export const value = 1;\n"]]),
				in_memory: true,
				configuration_snapshot_complete: false,
			}),
		);
		const record = context.source_record(file);

		expect(record.source_resolver.get(file) === record.typescript_ast.source_file_node()).toBe(true);
	});

	test("analyzes the supplied source snapshot without disk access", () => {
		const test_fixture = new TestFixture();
		const root = "/virtual/source-snapshot";
		const file = `${root}/source.ts`;
		const snapshot = new Map([[file, "export const value = 1;\n"]]);
		const file_io = new InMemoryFileIO();
		const context_factory = new LintProjectContextCreator(
			test_fixture.python_ast_data(),
			new ProjectAnalysisIdentity(file_io),
			new InMemoryProjectSourceIO(snapshot),
			file_io,
		);
		const context = context_factory.lint_context(
			context_factory.snapshot({
				repo_root: root,
				project_files: [file],
				ignore_files: [],
				stage_timer: test_fixture.stage_timer(),
				source_texts: snapshot,
				in_memory: true,
				configuration_snapshot_complete: false,
			}),
		);
		const text = context.source_record(file).text;

		expect(text).toBe("export const value = 1;\n");
	});

	test("keeps source record and source access aligned with the captured text", () => {
		const test_fixture = new TestFixture();
		const root = "/virtual/immutable-source-snapshot";
		const file = `${root}/source.ts`;
		const live_texts = new Map([[file, "export const value = 1;\n"]]);
		const source_io = new InMemoryProjectSourceIO(live_texts);
		const file_io = new InMemoryFileIO();
		const context_factory = new LintProjectContextCreator(
			test_fixture.python_ast_data(),
			new ProjectAnalysisIdentity(file_io),
			source_io,
			file_io,
		);
		const context = context_factory.lint_context(
			context_factory.snapshot({
				repo_root: root,
				project_files: [file],
				ignore_files: [],
				stage_timer: test_fixture.stage_timer(),
				source_texts: new Map(),
				in_memory: false,
				configuration_snapshot_complete: false,
			}),
		);
		live_texts.set(file, "export const value = 2;\n");

		expect([context.source_record(file).text, context.source_io().source_text(file)]).toEqual([
			"export const value = 1;\n",
			"export const value = 1;\n",
		]);
	});

	test("freezes TypeScript resolution configuration", () => {
		const test_fixture = new TestFixture();
		const root = "/virtual/immutable-resolution-snapshot";
		const file = `${root}/source.ts`;
		const config_file = `${root}/${TYPESCRIPT_CONFIG_FILE}`;
		const live_texts = new Map([
			[file, "export const value = 1;\n"],
			[config_file, '{ "compilerOptions": { "paths": { "@/*": ["src/*"] } } }\n'],
		]);
		const source_io = new InMemoryProjectSourceIO(live_texts);
		const file_io = new InMemoryFileIO();
		const context_factory = new LintProjectContextCreator(
			test_fixture.python_ast_data(),
			new ProjectAnalysisIdentity(file_io),
			source_io,
			file_io,
		);
		const context = context_factory.lint_context(
			context_factory.snapshot({
				repo_root: root,
				project_files: [file],
				ignore_files: [],
				stage_timer: test_fixture.stage_timer(),
				source_texts: new Map(),
				in_memory: false,
				configuration_snapshot_complete: false,
			}),
		);
		live_texts.set(config_file, "{}\n");

		expect(context.source_io().source_text(config_file)).toBe(
			'{ "compilerOptions": { "paths": { "@/*": ["src/*"] } } }\n',
		);
	});

	test("retains TypeScript configs inherited from outside the project root", () => {
		const test_fixture = new TestFixture();
		const root = "/virtual/inherited-config-snapshot";
		const file = `${root}/src/main.ts`;
		const inherited = "/virtual/shared/tsconfig.base.json";
		const live_texts = new Map([
			[`${root}/tsconfig.json`, '{"extends":"../shared/tsconfig.base.json"}\n'],
			[inherited, '{"compilerOptions":{"paths":{"@shared/*":["shared/*"]}}}\n'],
			[file, 'import { Value } from "@shared/value";\n'],
			["/virtual/shared/shared/value.ts", "export class Value {}\n"],
		]);
		const file_io = new InMemoryFileIO();
		const context_factory = new LintProjectContextCreator(
			test_fixture.python_ast_data(),
			new ProjectAnalysisIdentity(file_io),
			new InMemoryProjectSourceIO(live_texts),
			file_io,
		);
		const context = context_factory.lint_context(
			context_factory.snapshot({
				repo_root: root,
				project_files: [file],
				ignore_files: [],
				stage_timer: test_fixture.stage_timer(),
				source_texts: new Map(),
				in_memory: false,
				configuration_snapshot_complete: false,
			}),
		);
		const project_resolution = new TypeScriptProjectResolution(root, context.source_io());
		const resolution = project_resolution.resolution();

		expect({
			config_captured: context.source_io().source_available(inherited),
			mapped: resolution.non_relative_bases("@shared/value"),
		}).toEqual({
			config_captured: true,
			mapped: ["/virtual/shared/shared/value", "/virtual/shared/@shared/value"],
		});
	});

	test("freezes runtime modules and their project path inventory", () => {
		const test_fixture = new TestFixture();
		const root = "/virtual/immutable-module-snapshot";
		const file = `${root}/source.ts`;
		const runtime_module = `${root}/runtime.mjs`;
		const late_file = `${root}/late-added.ts`;
		const live_texts = new Map([
			[file, "export const value = 1;\n"],
			[runtime_module, "export const runtime = 1;\n"],
		]);
		const source_io = new InMemoryProjectSourceIO(live_texts);
		const file_io = new InMemoryFileIO();
		const context_factory = new LintProjectContextCreator(
			test_fixture.python_ast_data(),
			new ProjectAnalysisIdentity(file_io),
			source_io,
			file_io,
		);
		const context = context_factory.lint_context(
			context_factory.snapshot({
				repo_root: root,
				project_files: [file],
				ignore_files: [],
				stage_timer: test_fixture.stage_timer(),
				source_texts: new Map(),
				in_memory: false,
				configuration_snapshot_complete: false,
			}),
		);
		live_texts.set(runtime_module, "export const runtime = 2;\n");
		live_texts.set(late_file, "export const late = true;\n");

		expect([
			context.source_io().source_text(runtime_module),
			context.source_io().source_paths(root, new Set()),
		]).toEqual(["export const runtime = 1;\n", [file, runtime_module]]);
	});

	test("does not activate the Python bridge for a TypeScript-only context", () => {
		const test_fixture = new TestFixture();
		const root = "/virtual/typescript-only-context";
		const file = `${root}/tools/coding-lint/index.ts`;
		const file_io = new InMemoryFileIO();
		const context_factory = new LintProjectContextCreator(
			test_fixture.python_ast_data(),
			new ProjectAnalysisIdentity(file_io),
			new InMemoryProjectSourceIO(new Map()),
			file_io,
		);
		const statistics = test_fixture.with_empty_path(() =>
			context_factory
				.lint_context(
					context_factory.snapshot({
						repo_root: root,
						project_files: [file],
						ignore_files: [],
						stage_timer: test_fixture.stage_timer(),
						source_texts: new Map([[file, "export const value: number = 1;\n"]]),
						in_memory: true,
						configuration_snapshot_complete: false,
					}),
				)
				.statistics(),
		);
		expect(statistics).toEqual({ source_reads: 1, typescript_parses: 1, python_parses: 0, source_records: 1 });
	});

	test("unused-file results are equivalent with the shared context", () => {
		const fixture = new TestFixture();
		const unused_code = new UnusedCode();
		const result = fixture._project_source.with_in_memory_project(
			{
				"tools/coding-lint/index.ts": "export { value } from './dependency';\n",
				"tools/coding-lint/dependency.ts": "export const value = 1;\n",
				"tools/coding-lint/unused.ts": "export const unused = 1;\n",
			},
			({ root, context }) => {
				return unused_code.collect_unused_files({
					root,
					source: {
						context_state: { available: true, value: context },
						entry_files: ["tools/coding-lint/index.ts"],
					},
				});
			},
			new Map(),
		);
		expect(result.map((item) => item.file())).toEqual(["tools/coding-lint/unused.ts"]);
	});

	test("Python global unused-file collection does not emit TypeScript results", () => {
		const fixture = new TestFixture();
		const unused_code = new UnusedCode();
		const result = fixture._project_source.with_in_memory_project(
			{
				"tools/coding-lint/index.py": "from .dependency import value\n",
				"tools/coding-lint/dependency.py": "value = 1\n",
				"tools/coding-lint/unused.py": "unused = 1\n",
				"tools/coding-lint/index.ts": "export { value } from './dependency';\n",
				"tools/coding-lint/dependency.ts": "export const value = 1;\n",
				"tools/coding-lint/unused.ts": "export const unused = 1;\n",
			},
			({ root, context }) =>
				unused_code.unused_python_violations({
					root,
					source: {
						context_state: { available: true, value: context },
						entry_files: ["tools/coding-lint/index.py", "tools/coding-lint/index.ts"],
					},
				}),
			new Map(),
		);

		expect(result.map((item) => item.file())).toEqual(["tools/coding-lint/unused.py"]);
	});
});
