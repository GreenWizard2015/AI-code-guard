import { join } from "node:path";
import { describe, expect, test } from "@jest/globals";
import { ProjectSourcePython } from "src/core/project-source/project_source_python";
import { InMemoryProjectSourceIO } from "src/io/in_memory_project_source_io";
import { CompositionAnalyzer } from "src/linting/composition/composition_analyzer";
import { CompositionModel } from "src/linting/composition/composition_model";
import { TypeScriptCompositionModel } from "src/linting/composition/type_script_composition_model";
import { TypeScriptImportedFunctionAliases } from "src/model/type_script_imported_function_aliases";
import { TypeScriptModuleExportsContext } from "src/module-resolution/exports/type_script_module_exports_context";
import { TYPESCRIPT_FACADE_FILES } from "tests/bridge/ts/core/constants";
import { TestFixture } from "tests/core/test-fixture";
import ts from "typescript";

describe("coding-lint facade resolution", () => {
	const fixture = new TestFixture();

	test("resolves TypeScript function aliases through index.ts", () => {
		const result = fixture._project_source.with_in_memory_project(
			TYPESCRIPT_FACADE_FILES,
			({ root, context }) => {
				const consumer_file = join(root, "consumer.ts");
				const source_files = new Map(
					context
						.files()
						.filter((source) => source.language === "typescript")
						.map((source) => [source.absolute_path, source.typescript_ast.source_file_node()] as const),
				);
				const function_aliases = new TypeScriptImportedFunctionAliases(root, source_files, false, context.source_io());
				const source = context.source_record(consumer_file);
				if (source.language !== "typescript") {
					return { resolved_file: undefined, expected_file: join(root, "pkg/run.ts") };
				}
				const aliases = function_aliases.imported_function_aliases(source.typescript_ast.source_file_node());
				const run_alias = aliases.get("run");
				if (run_alias === undefined) {
					return { resolved_file: undefined, expected_file: join(root, "pkg/run.ts") };
				}
				return { resolved_file: run_alias.source_file, expected_file: join(root, "pkg/run.ts") };
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
		const result = fixture._project_source.with_in_memory_project(
			files,
			({ root, context }) => {
				const source_files = new Map(
					context
						.files()
						.filter((source) => source.language === "typescript")
						.map((source) => [source.absolute_path, source.typescript_ast.source_file_node()] as const),
				);
				const exports_context = new TypeScriptModuleExportsContext(root, source_files, false, context.source_io());
				const exports_table = exports_context.module_exports();
				const resolved = exports_table.resolve({ file: join(root, "barrel.ts"), name: "target" });
				return { resolved, expected: { file: join(root, "leaf.ts"), name: "target" } };
			},
			new Map(),
		);

		expect(result.resolved).toEqual(result.expected);
	});

	test("resolves TypeScript class composition through index.ts", () => {
		const result = fixture._project_source.with_in_memory_project(
			TYPESCRIPT_FACADE_FILES,
			({ root, context, files }) => {
				const consumer_file = join(root, "consumer.ts");
				const composition_parser = new CompositionModel(
					root,
					{
						root,
						files: new Set(files),
						resolver: new ProjectSourcePython(root),
					},
					fixture._project_source.typescript_source_files(context),
					false,
					context.source_io(),
				);
				const graph = composition_parser.class_graph(context.files());
				const consumer = graph.classes.get(`${consumer_file}:Consumer`);
				if (consumer === undefined) {
					return {
						dependencies: undefined,
						expected_dependency: `${join(root, "pkg/service.ts")}:Service`,
					};
				}
				return {
					dependencies: consumer.dependencies,
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
		const result = fixture._project_source.with_in_memory_project(
			files,
			({ root, context, files: paths }) => {
				const composition_model = new CompositionModel(
					root,
					{ root, files: new Set(paths), resolver: new ProjectSourcePython(root) },
					fixture._project_source.typescript_source_files(context),
					false,
					context.source_io(),
				);
				const graph = composition_model.class_graph(context.files());
				const a_key = `${join(root, "a.ts")}:A`;
				const b_key = `${join(root, "b.ts")}:B`;
				const c_key = `${join(root, "c.ts")}:C`;
				const d_key = `${join(root, "d.ts")}:D`;
				const class_a = graph.classes.get(a_key);
				const class_b = graph.classes.get(b_key);
				const class_c = graph.classes.get(c_key);
				let dependencies_a: string[] | undefined;
				if (class_a !== undefined) {
					dependencies_a = class_a.dependencies;
				}
				let dependencies_b: string[] | undefined;
				if (class_b !== undefined) {
					dependencies_b = class_b.dependencies;
				}
				let dependencies_c: string[] | undefined;
				if (class_c !== undefined) {
					dependencies_c = class_c.dependencies;
				}
				const analyzer = new CompositionAnalyzer(graph, root);
				const violations = analyzer.violations();
				const depth_rules = violations.filter((violation) => violation.rule_id() === "composition-depth");
				return {
					edges: [dependencies_a, dependencies_b, dependencies_c],
					expected_edges: [[b_key], [c_key], [d_key]],
					depth_rules: depth_rules.map((violation) => violation.rule_id()),
				};
			},
			new Map(),
		);

		expect(result.edges).toEqual(result.expected_edges);
		expect(result.depth_rules).toEqual(["composition-depth"]);
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
		const result = fixture._project_source.with_in_memory_project(
			files,
			({ root, context }) => {
				const path = join(root, "composition.ts");
				const composition_model = new CompositionModel(
					root,
					{ root, files: new Set([path]), resolver: new ProjectSourcePython(root) },
					fixture._project_source.typescript_source_files(context),
					false,
					context.source_io(),
				);
				const graph = composition_model.class_graph(context.files());
				const class_a = graph.classes.get(`${path}:A`);
				if (class_a === undefined) {
					return { dependencies: undefined, expected: `${path}:B` };
				}
				return {
					dependencies: class_a.dependencies,
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
		const result = fixture._project_source.with_in_memory_project(
			files,
			({ root, context }) => {
				const path = join(root, "classes.ts");
				const composition_model = new CompositionModel(
					root,
					{ root, files: new Set([path]), resolver: new ProjectSourcePython(root) },
					fixture._project_source.typescript_source_files(context),
					false,
					context.source_io(),
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
		const resolver_context = new TypeScriptModuleExportsContext(
			"",
			new Map(),
			false,
			new InMemoryProjectSourceIO(new Map()),
		);
		const model = new TypeScriptCompositionModel("composition.ts", source_file, resolver_context.module_exports());
		const owner = model.classes().find((item) => item.name === "Owner");
		let dependencies: string[] | undefined;
		let language: string | undefined;
		if (owner !== undefined) {
			dependencies = owner.dependencies;
			language = owner.language;
		}

		expect({ dependencies, language }).toEqual({
			dependencies: ["Dependency"],
			language: "typescript",
		});
	});

	test("resolves constructor-owned TypeScript dependencies across files", () => {
		const files = {
			"a.ts": 'import { B } from "./b"; export class A { private b: B; constructor() { this.b = new B(); } }',
			"b.ts": 'import { C } from "./c"; export class B { private c: C; constructor() { this.c = new C(); } }',
			"c.ts": 'import { D } from "./d"; export class C { private d: D; constructor() { this.d = new D(); } }',
			"d.ts": "export class D {}",
		};
		const result = fixture._project_source.with_in_memory_project(
			files,
			({ root, context, files: paths }) => {
				const composition_model = new CompositionModel(
					root,
					{
						root,
						files: new Set(paths),
						resolver: new ProjectSourcePython(root),
					},
					fixture._project_source.typescript_source_files(context),
					false,
					context.source_io(),
				);
				const graph = composition_model.class_graph(context.files());
				const class_a = graph.classes.get(`${join(root, "a.ts")}:A`);
				if (class_a === undefined) {
					return { dependencies: undefined, expected: `${join(root, "b.ts")}:B` };
				}
				return {
					dependencies: class_a.dependencies,
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
		const result = fixture._project_source.with_in_memory_project(
			files,
			({ root, context, files: paths }) => {
				const composition_parser = new CompositionModel(
					root,
					{
						root,
						files: new Set(paths),
						resolver: new ProjectSourcePython(root),
					},
					fixture._project_source.typescript_source_files(context),
					false,
					context.source_io(),
				);
				const graph = composition_parser.class_graph(context.files());
				const class_a = graph.classes.get(`${join(root, "a.ts")}:A`);
				if (class_a === undefined) {
					return { dependencies: undefined, expected: `${join(root, "b.ts")}:B` };
				}
				return {
					dependencies: class_a.dependencies,
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
		const result = fixture._project_source.with_in_memory_project(
			files,
			({ root, context, files: paths }) => {
				const composition_parser = new CompositionModel(
					root,
					{
						root,
						files: new Set(paths),
						resolver: new ProjectSourcePython(root),
					},
					fixture._project_source.typescript_source_files(context),
					false,
					context.source_io(),
				);
				const graph = composition_parser.class_graph(context.files());
				const consumer = graph.classes.get(`${join(root, "consumer.ts")}:Consumer`);
				if (consumer === undefined) {
					return {
						dependencies: undefined,
						expected_dependency: `${join(root, "pkg/service.ts")}:Service`,
					};
				}
				return { dependencies: consumer.dependencies, expected_dependency: `${join(root, "pkg/service.ts")}:Service` };
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
		const result = fixture._project_source.with_in_memory_project(
			files,
			({ root, context, files: paths }) => {
				const composition_model = new CompositionModel(
					root,
					{
						root,
						files: new Set(paths),
						resolver: new ProjectSourcePython(root),
					},
					new Map(),
					true,
					context.source_io(),
				);
				const graph = composition_model.class_graph(context.files());
				const first_imports = new Map(graph.imports_by_file.get(join(root, "first.py")));
				const second_imports = new Map(graph.imports_by_file.get(join(root, "second.py")));
				return {
					first: first_imports.get("Helper"),
					second: second_imports.get("Helper"),
					expected_file: join(root, "helper.py"),
				};
			},
			new Map(),
		);

		let first_file: string | undefined;
		if (result.first !== undefined) {
			first_file = result.first.file;
		}
		let second_file: string | undefined;
		if (result.second !== undefined) {
			second_file = result.second.file;
		}
		expect({ first_file, second_file }).toEqual({
			first_file: result.expected_file,
			second_file: result.expected_file,
		});
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
		const result = fixture._project_source.with_in_memory_project(
			files,
			({ root, context, files: paths }) => {
				const composition_model = new CompositionModel(
					root,
					{
						root,
						files: new Set(paths),
						resolver: new ProjectSourcePython(root),
					},
					new Map(),
					true,
					context.source_io(),
				);
				const graph = composition_model.class_graph(context.files());
				const consumer = graph.classes.get(`${join(root, "consumer.py")}:Consumer`);
				if (consumer === undefined) {
					return { dependencies: undefined, expected: `${join(root, "dependency.py")}:Dependency` };
				}
				return {
					dependencies: consumer.dependencies,
					expected: `${join(root, "dependency.py")}:Dependency`,
				};
			},
			new Map(),
		);

		expect(result.dependencies).toEqual([result.expected]);
	});
});
