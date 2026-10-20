import "src/linting/orchestration/runtime/global-analysis/composition_model";
import "src/linting/orchestration/runtime/global-analysis/callable-usage/callable_usage";
import { describe, expect, test } from "@jest/globals";
import ts from "typescript";
import { CompositionModel } from "src/linting/orchestration/runtime/global-analysis/composition_model";
import { TypeScriptCompositionModel } from "src/linting/orchestration/runtime/global-analysis/type_script_composition_model";
import { TypeScriptImportedFunctionAliases } from "src/model/type_script_imported_function_aliases";
import { TypeScriptModuleExports } from "src/module-resolution/type_script_module_exports";
import { TestFixture } from "tests/core/test-fixture";
import { join } from "node:path";
import { TYPESCRIPT_FACADE_FILES } from "tests/bridge/ts/core/constants";
import { ProjectSourcePython } from "src/core/project-source/project_source_python";
import { EmptySourceText } from "src/io/empty_source_text";
import { CompositionAnalyzer } from "src/linting/orchestration/runtime/composition/components/composition_analyzer";

describe("coding-lint facade resolution", () => {
	const fixture = new TestFixture();

	test("resolves TypeScript function aliases through index.ts", () => {
		const result = fixture.project_source.with_in_memory_project(
			TYPESCRIPT_FACADE_FILES,
			(root, context) => {
				const consumer_file = join(root, "consumer.ts");
				const source_files = new Map(
					context
						.files()
						.filter((source) => source.typescript())
						.map((source) => [source.absolute_path, source.typescript_ast.source_file_node()] as const),
				);
				const function_aliases = new TypeScriptImportedFunctionAliases(root, source_files, false, context.source_io);
				const source = context.source_record(consumer_file);
				if (source.language !== "typescript") {
					return { resolved_file: undefined, expected_file: join(root, "pkg/run.ts") };
				}
				const aliases = function_aliases.imported_function_aliases(source.typescript_ast.source_file_node());
				return { resolved_file: aliases.get("run")?.source_file, expected_file: join(root, "pkg/run.ts") };
			},
			new Map(),
		);
		expect(result.resolved_file).toBe(result.expected_file);
	});

	test("resolves a local re-export through the indexed imported binding", () => {
		const files = {
			"leaf.ts": "export const target = 1;\n",
			"barrel.ts": 'import { target } from "./leaf";\nexport { target };\n',
		};
		const result = fixture.project_source.with_in_memory_project(
			files,
			(root, context) => {
				const source_files = new Map(
					context
						.files()
						.filter((source) => source.typescript())
						.map((source) => [source.absolute_path, source.typescript_ast.source_file_node()] as const),
				);
				const exports_table = new TypeScriptModuleExports(root, source_files, false, context.source_io);
				const resolved = exports_table.resolve(join(root, "barrel.ts"), "target");
				return { resolved, expected: { file: join(root, "leaf.ts"), name: "target" } };
			},
			new Map(),
		);

		expect(result.resolved).toEqual(result.expected);
	});

	test("resolves TypeScript class composition through index.ts", () => {
		const result = fixture.project_source.with_in_memory_project(
			TYPESCRIPT_FACADE_FILES,
			(root, context, files) => {
				const consumer_file = join(root, "consumer.ts");
				const composition_parser = new CompositionModel(
					root,
					{
						root,
						files: new Set(files),
						resolver: new ProjectSourcePython(),
					},
					fixture.project_source.typescript_source_files(context),
					false,
					context.source_io,
				);
				const graph = composition_parser.class_graph(context.files());
				const consumer = graph.classes.get(`${consumer_file}:Consumer`);
				return {
					dependencies: consumer?.dependencies,
					expected_dependency: `${join(root, "pkg/service.ts")}:Service`,
				};
			},
			new Map(),
		);
		expect(result.dependencies).toContain(result.expected_dependency);
	});

	test("keeps a named class expression bound to its variable in composition", () => {
		const files = {
			"a.ts": 'import { B } from "./b"; export class A { private b = new B(); }',
			"b.ts": 'import { C } from "./c"; export const B = class InternalB { private c = new C(); };',
			"c.ts": 'import { D } from "./d"; export class C { private d = new D(); }',
			"d.ts": "export class D {}",
		};
		const result = fixture.project_source.with_in_memory_project(
			files,
			(root, context, paths) => {
				const composition_model = new CompositionModel(
					root,
					{ root, files: new Set(paths), resolver: new ProjectSourcePython() },
					fixture.project_source.typescript_source_files(context),
					false,
					context.source_io,
				);
				const graph = composition_model.class_graph(context.files());
				const a_key = `${join(root, "a.ts")}:A`;
				const b_key = `${join(root, "b.ts")}:B`;
				const c_key = `${join(root, "c.ts")}:C`;
				const d_key = `${join(root, "d.ts")}:D`;
				const analyzer = new CompositionAnalyzer(graph, root);
				const violations = analyzer.violations();
				return {
					edges: [
						graph.classes.get(a_key)?.dependencies,
						graph.classes.get(b_key)?.dependencies,
						graph.classes.get(c_key)?.dependencies,
					],
					expected_edges: [[b_key], [c_key], [d_key]],
					depth_rule: violations.find((violation) => violation.rule_id === "composition-depth")?.rule_id,
				};
			},
			new Map(),
		);

		expect(result.edges).toEqual(result.expected_edges);
		expect(result.depth_rule).toBe("composition-depth");
	});

	test("keeps constructor dependencies for variable-bound class expressions", () => {
		const files = {
			"composition.ts": [
				"const B = class {};",
				"class A {",
				"  private b: B;",
				"  constructor() { this.b = new B(); }",
				"}",
			].join("\n"),
		};
		const result = fixture.project_source.with_in_memory_project(
			files,
			(root, context) => {
				const path = join(root, "composition.ts");
				const composition_model = new CompositionModel(
					root,
					{ root, files: new Set([path]), resolver: new ProjectSourcePython() },
					fixture.project_source.typescript_source_files(context),
					false,
					context.source_io,
				);
				const graph = composition_model.class_graph(context.files());
				return {
					dependencies: graph.classes.get(`${path}:A`)?.dependencies,
					expected: `${path}:B`,
				};
			},
			new Map(),
		);

		expect(result.dependencies).toEqual([result.expected]);
	});

	test("keeps class expression bindings distinct when internal names repeat", () => {
		const files = {
			"classes.ts": "export const First = class Shared {}; export const Second = class Shared {};",
		};
		const result = fixture.project_source.with_in_memory_project(
			files,
			(root, context) => {
				const path = join(root, "classes.ts");
				const composition_model = new CompositionModel(
					root,
					{ root, files: new Set([path]), resolver: new ProjectSourcePython() },
					fixture.project_source.typescript_source_files(context),
					false,
					context.source_io,
				);
				const graph = composition_model.class_graph(context.files());
				const classes = graph.classes_by_file.get(path);
				let names: string[] = [];
				if (classes !== undefined) {
					names = [...classes.keys()];
					names.sort();
				}
				const all_class_names = [...graph.classes.keys()];
				all_class_names.sort();
				return {
					file: path,
					names,
					keys: all_class_names,
				};
			},
			new Map(),
		);

		expect(result.names).toEqual(["First", "Second"]);
		expect(result.keys).toEqual([`${result.file}:First`, `${result.file}:Second`]);
	});

	test("tracks constructor-owned TypeScript dependencies", () => {
		const source_file = ts.createSourceFile(
			"composition.ts",
			"class Owner { private dependency: Dependency; constructor() { this.dependency = new Dependency(); } } class Dependency {}",
			ts.ScriptTarget.Latest,
			true,
		);
		const model = new TypeScriptCompositionModel(
			"composition.ts",
			source_file,
			new TypeScriptModuleExports("", new Map(), false, new EmptySourceText()),
		);
		const owner = model.classes().find((item) => item.name === "Owner");

		expect(owner?.dependencies).toEqual(["Dependency"]);
	});

	test("resolves constructor-owned TypeScript dependencies across files", () => {
		const files = {
			"a.ts": 'import { B } from "./b"; export class A { private b: B; constructor() { this.b = new B(); } }',
			"b.ts": 'import { C } from "./c"; export class B { private c: C; constructor() { this.c = new C(); } }',
			"c.ts": 'import { D } from "./d"; export class C { private d: D; constructor() { this.d = new D(); } }',
			"d.ts": "export class D {}",
		};
		const result = fixture.project_source.with_in_memory_project(
			files,
			(root, context, paths) => {
				const composition_model = new CompositionModel(
					root,
					{
						root,
						files: new Set(paths),
						resolver: new ProjectSourcePython(),
					},
					fixture.project_source.typescript_source_files(context),
					false,
					context.source_io,
				);
				const graph = composition_model.class_graph(context.files());
				return {
					dependencies: graph.classes.get(`${join(root, "a.ts")}:A`)?.dependencies,
					expected: `${join(root, "b.ts")}:B`,
				};
			},
			new Map(),
		);

		expect(result.dependencies).toContain(result.expected);
	});

	test("resolves namespace-imported TypeScript construction dependencies", () => {
		const files = {
			"a.ts": [
				'import * as deps from "./b"; export class A { private b: deps.B; constructor() { this.b = new deps.B(); } }',
			].join("\n"),
			"b.ts": "export class B {}",
		};
		const result = fixture.project_source.with_in_memory_project(
			files,
			(root, context, paths) => {
				const composition_parser = new CompositionModel(
					root,
					{
						root,
						files: new Set(paths),
						resolver: new ProjectSourcePython(),
					},
					fixture.project_source.typescript_source_files(context),
					false,
					context.source_io,
				);
				const graph = composition_parser.class_graph(context.files());
				return {
					dependencies: graph.classes.get(`${join(root, "a.ts")}:A`)?.dependencies,
					expected: `${join(root, "b.ts")}:B`,
				};
			},
			new Map(),
		);

		expect(result.dependencies).toContain(result.expected);
	});

	test("resolves root-based TypeScript imports through the shared module resolver", () => {
		const files = {
			"consumer.ts":
				'import { Service } from "pkg";\nexport class Consumer { private readonly service = new Service(); }\n',
			"pkg/index.ts": 'export { Service } from "./service";\n',
			"pkg/service.ts": "export class Service {}\n",
		};
		const result = fixture.project_source.with_in_memory_project(
			files,
			(root, context, paths) => {
				const composition_parser = new CompositionModel(
					root,
					{
						root,
						files: new Set(paths),
						resolver: new ProjectSourcePython(),
					},
					fixture.project_source.typescript_source_files(context),
					false,
					context.source_io,
				);
				const graph = composition_parser.class_graph(context.files());
				const consumer = graph.classes.get(`${join(root, "consumer.ts")}:Consumer`);
				return { dependencies: consumer?.dependencies, expected_dependency: `${join(root, "pkg/service.ts")}:Service` };
			},
			new Map(),
		);
		expect(result.dependencies).toContain(result.expected_dependency);
	});

	test("resolves Python imports across every source in one composition run", () => {
		const files = {
			"helper.py": "class Helper:\n    pass\n",
			"first.py": "from .helper import Helper\nclass First(Helper):\n    pass\n",
			"second.py": "from .helper import Helper\nclass Second(Helper):\n    pass\n",
		};
		const result = fixture.project_source.with_in_memory_project(
			files,
			(root, context, paths) => {
				const composition_model = new CompositionModel(
					root,
					{
						root,
						files: new Set(paths),
						resolver: new ProjectSourcePython(),
					},
					new Map(),
					true,
					context.source_io,
				);
				const graph = composition_model.class_graph(context.files());
				return {
					first: graph.imports_by_file.get(join(root, "first.py"))?.get("Helper"),
					second: graph.imports_by_file.get(join(root, "second.py"))?.get("Helper"),
					expected_file: join(root, "helper.py"),
				};
			},
			new Map(),
		);

		expect(result.first?.file).toBe(result.expected_file);
		expect(result.second?.file).toBe(result.expected_file);
	});

	test("tracks Python construction calls without method-local call edges", () => {
		const files = {
			"dependency.py": "class Dependency:\n    pass\n",
			"consumer.py":
				"from .dependency import Dependency\n" +
				"class Consumer:\n" +
				"    def __init__(self):\n" +
				"        self.dependency = Dependency()\n" +
				"    def build(self):\n" +
				"        return Dependency()\n",
		};
		const result = fixture.project_source.with_in_memory_project(
			files,
			(root, context, paths) => {
				const composition_model = new CompositionModel(
					root,
					{
						root,
						files: new Set(paths),
						resolver: new ProjectSourcePython(),
					},
					new Map(),
					true,
					context.source_io,
				);
				const graph = composition_model.class_graph(context.files());
				const consumer = graph.classes.get(`${join(root, "consumer.py")}:Consumer`);
				return {
					dependencies: consumer?.dependencies,
					expected: `${join(root, "dependency.py")}:Dependency`,
				};
			},
			new Map(),
		);

		expect(result.dependencies).toEqual([result.expected]);
	});
});
