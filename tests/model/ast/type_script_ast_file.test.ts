import ts from "typescript";

import { TypeScriptAstFile } from "src/model/ast/type_script_ast_file";
import { TypeScriptTypeNode } from "src/model/type_script_type_node";

import { TYPE_NODE_SOURCE, AST_SOURCE } from "tests/core/constants";

describe("TypeScriptAstFile", () => {
	test("wraps TypeScript type-node predicates and details", () => {
		const declarations = ts
			.createSourceFile("types.ts", TYPE_NODE_SOURCE, ts.ScriptTarget.Latest, true, ts.ScriptKind.TS)
			.statements.filter(ts.isTypeAliasDeclaration);
		const nodes = declarations.map((declaration) => new TypeScriptTypeNode(declaration.type));
		const details = nodes.map((node) => node.details());
		expect({
			parenthesized: details[0].parenthesized_type !== undefined,
			union: details[1].union,
			union_count: details[1].union_types.length,
			function: details[2].is_function,
			reference: details[3].reference_name,
			argument_count: details[3].reference_arguments.length,
		}).toEqual({
			parenthesized: true,
			union: true,
			union_count: 2,
			function: true,
			reference: "Array",
			argument_count: 1,
		});
	});

	test("extracts top-level classes and methods", () => {
		const parsed = new TypeScriptAstFile("fixture.ts", AST_SOURCE);
		const class_nodes = parsed.classes();
		const first_class = class_nodes[0];
		const first_class_methods = first_class.methods;
		const second_method = first_class_methods[1];
		expect({
			classes: class_nodes.map((node) => node.name),
			methods: first_class_methods.map((node) => [node.name, node.argument_count]),
			sloc: first_class.sloc,
			lines: first_class.lines,
			argument_uses: second_method.argument_uses,
		}).toEqual({
			classes: ["Service", "Worker"],
			methods: [
				["constructor", 1],
				["run", 2],
			],
			sloc: 4,
			lines: 4,
			argument_uses: expect.arrayContaining([expect.objectContaining({ name: "first", count: 4 })]),
		});
	});

	test("extracts functions and metrics", () => {
		const parsed = new TypeScriptAstFile("fixture.ts", AST_SOURCE);
		expect(parsed.functions().map((node) => [node.name, node.argument_count])).toEqual([
			["build", 2],
			["convert", 1],
		]);
	});

	test("reports callable metrics and normalized issues", () => {
		const parsed = new TypeScriptAstFile("fixture.ts", AST_SOURCE);
		expect({
			methods_have_characters: parsed
				.classes()
				.flatMap((node) => node.methods)
				.every((node) => node.characters !== undefined && node.characters > 0),
			functions_have_characters: parsed
				.functions()
				.every((node) => node.characters !== undefined && node.characters > 0),
			parse_issues: parsed.normalized().parse_issues,
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
		const cached_result = { ...ast_file.normalized(), call_references: [] };

		expect(ast_file.reference_normalization(cached_result)).toBe(cached_result);
		expect(ast_file.normalized()).toBe(cached_result);
	});

	test("reuses the AST traversal and preserves constructor state", () => {
		const ast_file = new TypeScriptAstFile(
			"item.ts",
			"class Service { constructor() { this.value = 1; } run() { return this.value; } }",
		);

		let first_count = 0;
		let second_count = 0;
		let child_count = 0;
		let constructor_body = false;
		ast_file.traversal.visit((node, inside_constructor) => {
			first_count += 1;
			if (inside_constructor && ts.isBlock(node)) {
				constructor_body = true;
			}
		});
		ast_file.traversal.visit(() => {
			second_count += 1;
		});
		ast_file.traversal.visit_children(() => {
			child_count += 1;
		});
		expect({
			reused: second_count === first_count,
			constructor_body,
			traversed_nodes: first_count > 1,
			children_exclude_root: child_count === first_count - 1,
		}).toEqual({
			reused: true,
			constructor_body: true,
			traversed_nodes: true,
			children_exclude_root: true,
		});
	});

	test("reuses function owners for branch analysis", () => {
		const ast_file = new TypeScriptAstFile(
			"branches.ts",
			"function run() { if (true) { return 1; } }\nconst nested = () => { if (false) { return 2; } };",
		);
		const owners: string[] = [];
		ast_file.traversal.visit_function_owners((node, owner) => {
			if (!ts.isIfStatement(node)) {
				return;
			}
			if (!ts.isFunctionDeclaration(owner)) {
				return;
			}
			if (owner.name !== undefined) {
				owners.push(owner.name.text);
			}
		});
		expect(owners).toEqual(["run"]);
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
		const service_class = class_nodes[1];
		const service_methods = service_class.methods;
		const run_method = service_methods[0];
		expect(run_method.typed_arguments).toEqual([
			{ name: "this", type: "Service<T>", kind: "generic" },
			{ name: "value", type: "T", kind: "template" },
			{ name: "result", type: "Promise<Result>", kind: "generic" },
			{ name: "id", type: "string", kind: "basic" },
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

		expect(parsed.normalized().reference_aliases).toEqual([{ name: "RequestAlias", target: "RequestData" }]);
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

		expect(parsed.normalized().named_symbols.map((symbol) => symbol.name)).toEqual(
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

		expect(parsed.normalized().named_symbols.map((symbol) => symbol.name)).toEqual(
			expect.arrayContaining(["_value", "read", "argument"]),
		);
	});
});
