import "src/linting/orchestration/runtime/global-analysis/composition_model";
import "src/linting/orchestration/runtime/global-analysis/callable-usage/callable_usage";
import { describe, expect, test } from "@jest/globals";
import ts from "typescript";
import { CompositionModel } from "src/linting/orchestration/runtime/global-analysis/composition_model";
import { TypeScriptModuleExports } from "src/module-resolution/type_script_module_exports";
import { TypeScriptModuleExports as TypeScriptSourceExports } from "src/parser/analysis/type_script_module_exports";
import { TestFixture } from "tests/core/test-fixture";
import { join } from "node:path";
import { TYPESCRIPT_FACADE_FILES } from "tests/bridge/ts/core/constants";
import { ProjectSourcePython } from "src/core/project-source/project_source_python";

describe("coding-lint facade resolution part two", () => {
	const fixture = new TestFixture();

	test("resolves TypeScript type exports through index.ts", () => {
		const result = fixture.with_in_memory_project(
			TYPESCRIPT_FACADE_FILES,
			(root, context) => {
				const source_files = new Map(
					context
						.files()
						.filter((source) => source.typescript())
						.map((source) => [source.absolute_path, source.typescript_ast.source_file_node()] as const),
				);
				const export_resolver = new TypeScriptModuleExports(root, source_files, false, context.source_io);
				const index_file = join(root, "pkg/index.ts");
				const resolved = export_resolver.resolve(index_file, "User");
				return { resolved_file: resolved.file, expected_file: join(root, "pkg/types.ts") };
			},
			new Map(),
		);
		expect(result.resolved_file).toBe(result.expected_file);
	});

	test("resolves emitted JavaScript imports to TypeScript sources", () => {
		const files = {
			"service.ts": "export class Service {}\n",
			"consumer.ts": 'import { Service } from "./service.js";\nexport const value = new Service();\n',
		};
		const result = fixture.with_in_memory_project(
			files,
			(root, context) => {
				const consumer = context.source_record(join(root, "consumer.ts"));
				const source_files = new Map(
					context
						.files()
						.filter((source) => source.typescript())
						.map((source) => [source.absolute_path, source.typescript_ast.source_file_node()] as const),
				);
				const resolver = new TypeScriptModuleExports(root, source_files, false, context.source_io);
				if (consumer.language !== "typescript") {
					return { resolved: "", expected: join(root, "service.ts") };
				}
				return {
					resolved: resolver.module_symbol(join(root, "consumer.ts"), "./service.js"),
					expected: join(root, "service.ts"),
				};
			},
			new Map(),
		);
		expect(result.resolved).toBe(result.expected);
	});

	test("does not cache a cycle-blocked negative export result", () => {
		const files = {
			"a.ts": 'export * from "./b";\nexport * from "./c";\n',
			"b.ts": 'export * from "./a";\n',
			"c.ts": "export class Service {}\n",
		};
		const result = fixture.with_in_memory_project(
			files,
			(root, context) => {
				const source_files = new Map(
					context
						.files()
						.filter((source) => source.typescript())
						.map((source) => [source.absolute_path, source.typescript_ast.source_file_node()] as const),
				);
				const resolver = new TypeScriptModuleExports(root, source_files, false, context.source_io);
				const a = join(root, "a.ts");
				const b = join(root, "b.ts");
				resolver.resolve(a, "Service");
				return resolver.resolve(b, "Service").file;
			},
			new Map(),
		);
		expect(result).toContain("c.ts");
	});

	test("resolves factory and instance declarations through index.ts", () => {
		const files = {
			"pkg/index.ts": 'export { create, service } from "./service";\n',
			"pkg/service.ts": [
				"export class Service {}",
				"export function create(): Service { return new Service(); }",
				"export const service = new Service();",
			].join("\n"),
		};
		const result = fixture.with_in_memory_project(
			files,
			(root, context) => {
				const source_files = new Map(
					context
						.files()
						.filter((source) => source.typescript())
						.map((source) => [source.absolute_path, source.typescript_ast.source_file_node()] as const),
				);
				const resolver = new TypeScriptSourceExports(root, source_files, false, context.source_io);
				const index_file = join(root, "pkg/index.ts");
				const factory = resolver.resolved_exported_declaration(index_file, "create");
				const instance = resolver.resolved_exported_declaration(index_file, "service");
				return {
					factory: factory.some((node) => ts.isFunctionDeclaration(node)),
					instance: instance.some((node) => ts.isVariableDeclaration(node)),
				};
			},
			new Map(),
		);
		expect(result).toEqual({ factory: true, instance: true });
	});

	test("resolves Python classes through __init__.py", () => {
		const result = fixture.with_in_memory_project(
			{
				"pkg/__init__.py": "from .service import Service\n",
				"pkg/service.py": "class Service:\n    pass\n",
				"pkg/consumer.py":
					"from . import Service\n\nclass Consumer:\n    def __init__(self):\n        self.service = Service()\n",
			},
			(root, context, files) => {
				const composition_parser = new CompositionModel(
					root,
					{ root, files: new Set(files), resolver: new ProjectSourcePython() },
					new Map(),
					false,
					context.source_io,
				);
				const graph = composition_parser.class_graph(context.files());
				const consumer = graph.classes.get(`${join(root, "pkg/consumer.py")}:Consumer`);
				return {
					dependencies: consumer?.dependencies,
					expected_dependency: `${join(root, "pkg/service.py")}:Service`,
				};
			},
			new Map(),
		);
		expect(result.dependencies).toContain(result.expected_dependency);
	});

	test("resolves Python package exports from the loaded source snapshot", () => {
		const result = fixture.with_in_memory_project(
			{
				"pkg/__init__.py": "from .service import Service\n",
				"pkg/service.py": "class Service:\n    pass\n",
				"pkg/other.py": "class Service:\n    pass\n",
				"pkg/consumer.py":
					"from . import Service\n\nclass Consumer:\n    def __init__(self):\n        self.service = Service()\n",
			},
			(root, context, files, source_texts) => {
				source_texts.set(join(root, "pkg/__init__.py"), "from .other import Service\n");
				const composition_model = new CompositionModel(
					root,
					{ root, files: new Set(files), resolver: new ProjectSourcePython() },
					new Map(),
					false,
					context.source_io,
				);
				const graph = composition_model.class_graph(context.files());
				const consumer = graph.classes.get(`${join(root, "pkg/consumer.py")}:Consumer`);
				return { dependencies: consumer?.dependencies, expected: `${join(root, "pkg/service.py")}:Service` };
			},
			new Map(),
		);
		expect(result.dependencies).toContain(result.expected);
	});

	test("resolves Python classes through project-absolute imports", () => {
		const result = fixture.with_in_memory_project(
			{
				"pkg/service.py": "class Service:\n    pass\n",
				"pkg/consumer.py":
					"from pkg.service import Service\n\nclass Consumer:\n    def __init__(self):\n        self.service = Service()\n",
			},
			(root, context, files) => {
				const composition_model = new CompositionModel(
					root,
					{ root, files: new Set(files), resolver: new ProjectSourcePython() },
					new Map(),
					false,
					context.source_io,
				);
				const graph = composition_model.class_graph(context.files());
				const consumer = graph.classes.get(`${join(root, "pkg/consumer.py")}:Consumer`);
				return {
					dependencies: consumer?.dependencies,
					expected_dependency: `${join(root, "pkg/service.py")}:Service`,
				};
			},
			new Map(),
		);
		expect(result.dependencies).toContain(result.expected_dependency);
	});

	test("does not recurse forever through a package self-export", () => {
		const result = fixture.with_in_memory_project(
			{
				"pkg/__init__.py": "from . import worker\n",
				"pkg/worker.py": "class Worker:\n    pass\n",
				"consumer.py": "from pkg import worker\n\nclass Consumer:\n    pass\n",
			},
			(root, context, files) => {
				const composition_model = new CompositionModel(
					root,
					{ root, files: new Set(files), resolver: new ProjectSourcePython() },
					new Map(),
					false,
					context.source_io,
				);
				return composition_model.class_graph(context.files()).classes.size;
			},
			new Map(),
		);
		expect(result).toBe(2);
	});
});
