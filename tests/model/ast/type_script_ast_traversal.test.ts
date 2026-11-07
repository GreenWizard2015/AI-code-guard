import ts from "typescript";

import { TypeScriptAstFile } from "src/model/ast/type_script_ast_file";
import { TypeScriptAstTraversal } from "src/parser/analysis/type_script_ast_traversal";

describe("TypeScriptAstTraversal", () => {
	test("reuses traversal results and preserves constructor state", () => {
		const ast_file = new TypeScriptAstFile(
			"item.ts",
			"class Service { constructor() { this.value = 1; } run() { return this.value; } }",
		);
		const traversal = new TypeScriptAstTraversal(ast_file.source_file_node());
		let first_count = 0;
		let second_count = 0;
		let child_count = 0;
		let constructor_body = false;
		traversal.visit(({ node, inside_constructor }) => {
			first_count += 1;
			if (inside_constructor && ts.isBlock(node)) {
				constructor_body = true;
			}
		});
		traversal.visit(() => {
			second_count += 1;
		});
		traversal.visit_descendants(() => {
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

	test("visits registered syntax and prunes nested traversal", () => {
		const ast_file = new TypeScriptAstFile("calls.ts", "function run() { outer(inner()); }");
		const traversal = new TypeScriptAstTraversal(ast_file.source_file_node());
		const visited_kinds = new Uint8Array(ts.SyntaxKind.Count);
		visited_kinds[ts.SyntaxKind.CallExpression] = 1;
		const calls: string[] = [];
		const pruned_calls: string[] = [];

		traversal.visit_registered_nodes(
			ast_file.source_file_node(),
			(node) => {
				calls.push(node.getText());
				return true;
			},
			visited_kinds,
		);
		traversal.visit_registered_nodes(
			ast_file.source_file_node(),
			(node) => {
				pruned_calls.push(node.getText());
				return node.getText() !== "outer(inner())";
			},
			visited_kinds,
		);

		expect({ calls, pruned_calls }).toEqual({
			calls: ["outer(inner())", "inner()"],
			pruned_calls: ["outer(inner())"],
		});
	});

	test("preserves callable owners during branch analysis", () => {
		const ast_file = new TypeScriptAstFile(
			"branches.ts",
			"function run() { if (true) { return 1; } }\nconst nested = () => { if (false) { return 2; } };",
		);
		const traversal = new TypeScriptAstTraversal(ast_file.source_file_node());
		const owners: string[] = [];
		traversal.visit_function_owners((node, owner) => {
			if (!ts.isIfStatement(node)) {
				return;
			}
			if (!ts.isFunctionDeclaration(owner)) {
				return;
			}
			if (owner.name === undefined) {
				return;
			}
			owners.push(owner.name.text);
		});

		expect(owners).toEqual(["run"]);
	});
});
