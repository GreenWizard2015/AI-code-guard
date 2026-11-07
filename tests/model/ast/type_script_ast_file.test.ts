import ts from "typescript";

import { TypeScriptAstFile } from "src/model/ast/type_script_ast_file";
import { TypeScriptTypeNode } from "src/model/type_script_type_node";

import { AST_SOURCE, TYPE_NODE_SOURCE } from "tests/core/constants/ast_nodes/constants";

describe("TypeScriptAstFile", () => {
	test("wraps TypeScript type-node predicates and details", () => {
		const declarations = ts
			.createSourceFile("types.ts", TYPE_NODE_SOURCE, ts.ScriptTarget.Latest, true, ts.ScriptKind.TS)
			.statements.filter(ts.isTypeAliasDeclaration);
		const nodes = declarations.map((declaration) => new TypeScriptTypeNode(declaration.type));
		const details = nodes.map((node) => node.details());
		expect({
			parenthesized: details.map((detail) => detail.parenthesized_type.length > 0),
			union: details.map((detail) => detail.union),
			union_count: details.map((detail) => detail.union_types.length),
			function: details.map((detail) => detail.is_function),
			reference: details.map((detail) => detail.reference_name),
			argument_count: details.map((detail) => detail.reference_arguments.length),
		}).toEqual({
			parenthesized: [true, false, false, false],
			union: [false, true, false, false],
			union_count: [0, 2, 0, 0],
			function: [false, false, true, false],
			reference: ["", "", "", "Array"],
			argument_count: [0, 0, 0, 1],
		});
	});

	test("extracts top-level classes and methods", () => {
		const parsed = new TypeScriptAstFile("fixture.ts", AST_SOURCE);
		const class_nodes = parsed.classes();
		expect({
			classes: class_nodes.map((node) => node.identity.name),
			methods: class_nodes.map((class_node) =>
				class_node.structure.methods.map((node) => [node.identity.name, node.metrics.argument_count]),
			),
			sloc: class_nodes.map((class_node) => class_node.identity.sloc),
			lines: class_nodes.map((class_node) => class_node.identity.lines),
			base_class_names: class_nodes.map((class_node) => class_node.structure.base_class_names),
			argument_uses: class_nodes.flatMap((class_node) =>
				class_node.structure.methods.flatMap((method) => method.signature.argument_uses),
			),
		}).toEqual({
			classes: ["Service", "Worker"],
			methods: [
				[
					["constructor", 1],
					["run", 2],
				],
				[["execute", 0]],
			],
			sloc: [4, 3],
			lines: [4, 3],
			base_class_names: [["Record"], []],
			argument_uses: expect.arrayContaining([expect.objectContaining({ name: "first", count: 4 })]),
		});
	});

	test("collects nested classes, interfaces, and class-expression variable names", () => {
		const parsed = new TypeScriptAstFile(
			"nested.ts",
			"const Service = class {}; class Outer { run(): void { class Nested {} } } namespace Shapes { export interface Shape { id: string; } }",
		);
		const declarations = parsed.classes();

		expect({
			names: declarations.map((node) => node.identity.name),
			fields: declarations.map((node) => node.field_analysis.fields.map((field) => field.name)),
		}).toEqual({
			names: ["Service", "Outer", "Nested", "Shape"],
			fields: [[], [], [], ["id"]],
		});
	});

	test("extracts functions and metrics", () => {
		const parsed = new TypeScriptAstFile("fixture.ts", AST_SOURCE);
		expect(parsed.functions().map((node) => [node.identity.name, node.metrics.argument_count])).toEqual([
			["build", 2],
			["convert", 1],
		]);
	});

	test("reports callable metrics and normalized issues", () => {
		const parsed = new TypeScriptAstFile("fixture.ts", AST_SOURCE);
		expect({
			methods_have_characters: parsed
				.classes()
				.flatMap((node) => node.structure.methods)
				.every((node) => node.metrics.characters > 0),
			functions_have_characters: parsed.functions().every((node) => node.metrics.characters > 0),
			parse_issues: parsed.normalized().source.parse_issues,
		}).toEqual({ methods_have_characters: true, functions_have_characters: true, parse_issues: [] });
	});

	test("reuses the normalized TypeScript AST result", () => {
		const ast_file = new TypeScriptAstFile("item.ts", "type Item = string;\n");

		const first_result = ast_file.normalized();
		const second_result = ast_file.normalized();

		expect(second_result).toBe(first_result);
	});

	test("reuses the complete cached normalized AST result", () => {
		const ast_file = new TypeScriptAstFile("item.ts", "type Item = string;\n");
		const cached_ast = ast_file.normalized();
		const cached_result = {
			...cached_ast,
			references: { ...cached_ast.references, call_references: [] },
		};

		expect(ast_file.reference_normalization(cached_result)).toBe(cached_result);
		expect(ast_file.normalized()).toBe(cached_result);
	});
	test("keeps declaration metadata bound to each source file", () => {
		const first = new TypeScriptAstFile("first.ts", "\nconst FIRST = 1;\n");
		const second = new TypeScriptAstFile("second.ts", "\n\nconst SECOND = 2;\n");
		const first_symbols = first.normalized().references.named_symbols;
		const second_symbols = second.normalized().references.named_symbols;

		expect({
			first: first_symbols.map(({ name, line }) => [name, line]),
			second: second_symbols.map(({ name, line }) => [name, line]),
		}).toEqual({
			first: [["FIRST", 1]],
			second: [["SECOND", 2]],
		});
	});

	test("distinguishes template, generic, named, and basic arguments", () => {
		const parsed = new TypeScriptAstFile(
			"typed-arguments.ts",
			[
				"class Result {}",
				"class Service<T> {",
				"  run(this: Service<T>, value: T, result: Promise<Result>, id: string) {",
				"    return [this, value, result, id];",
				"  }",
				"}",
			].join("\n"),
		);

		const class_nodes = parsed.classes();
		expect(
			class_nodes.map((class_node) => class_node.structure.methods.map((method) => method.signature.typed_arguments)),
		).toEqual([
			[],
			[
				[
					{ name: "this", type: "Service<T>", kind: "generic" },
					{ name: "value", type: "T", kind: "template" },
					{ name: "result", type: "Promise<Result>", kind: "generic" },
					{ name: "id", type: "string", kind: "basic" },
				],
			],
		]);
	});

	test("collects named import aliases for reference normalization", () => {
		const parsed = new TypeScriptAstFile(
			"aliases.ts",
			[
				"import { RequestData as RequestAlias, OtherData } from './model';",
				"function read(value: RequestAlias) { return value; }",
			].join("\n"),
		);

		expect(parsed.normalized().references.reference_aliases).toEqual([{ name: "RequestAlias", target: "RequestData" }]);
	});

	test("collects named symbols from declaration candidates", () => {
		const parsed = new TypeScriptAstFile(
			"symbols.ts",
			[
				"import { value as _value } from './source';",
				"const module_value = 1;",
				"class Service { field = module_value; run(parameter: string) { return parameter; } }",
				"function read(argument: string) { return argument; }",
			].join("\n"),
		);

		expect(parsed.normalized().references.named_symbols.map((symbol) => symbol.name)).toEqual(
			expect.arrayContaining(["_value", "module_value", "field", "parameter", "read", "argument"]),
		);
	});

	test("retains named symbols while skipping irrelevant syntax nodes", () => {
		const parsed = new TypeScriptAstFile(
			"metadata-symbols.ts",
			[
				"import { value as _value } from './source';",
				"type Result = { value: string };",
				"function read(argument: string): Result { return { value: argument }; }",
			].join("\n"),
		);

		expect(parsed.normalized().references.named_symbols.map((symbol) => symbol.name)).toEqual(
			expect.arrayContaining(["_value", "read", "argument"]),
		);
	});
});
