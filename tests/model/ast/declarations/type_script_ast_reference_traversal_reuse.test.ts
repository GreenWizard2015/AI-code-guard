import { describe, expect, test } from "@jest/globals";
import { InMemoryProjectSourceIO } from "src/io/in_memory_project_source_io";
import { LintStageTimer } from "src/lint_stage_timer";
import { TypeScriptCallReferenceCollector } from "src/model/ast/declarations/type_script_call_reference_collector";
import { TypeScriptAstFile } from "src/model/ast/type_script_ast_file";
import { TypeScriptAstTraversal } from "src/parser/analysis/type_script_ast_traversal";
import { TypeScriptObjectAliasDeclarationIndex } from "src/parser/typescript-aliases/type_script_object_alias_declaration_index";
import ts from "typescript";

describe("TypeScript AST reference traversal reuse", () => {
	test("preserves owners through anonymous and named classes", () => {
		const source_text =
			"class Outer { run(): void { const outer = 1; const anonymous = class { run(): void { const inner = 2; class Named { run(): void { const nested = 3; } } } }; } }";
		const ast_file = new TypeScriptAstFile("owners.ts", source_text);
		const traversal = new TypeScriptAstTraversal(ast_file.source_file_node());
		const owners = new Map<string, string>();
		traversal.visit((traversal_node) => {
			const { node, owner } = traversal_node;
			if (ts.isVariableDeclaration(node) && ts.isIdentifier(node.name)) {
				owners.set(node.name.text, owner);
			}
		});

		expect([...owners]).toEqual([
			["outer", "Outer"],
			["anonymous", "Outer"],
			["inner", ""],
			["nested", "Named"],
		]);
	});

	test("keeps constructor state on its child nodes", () => {
		const source_text = "class Subject { constructor() { const value = 1; } }";
		const ast_file = new TypeScriptAstFile("constructor.ts", source_text);
		const traversal = new TypeScriptAstTraversal(ast_file.source_file_node());
		const contexts: string[] = [];
		traversal.visit(({ node, inside_constructor, function_owner }) => {
			if (ts.isVariableDeclaration(node) && ts.isIdentifier(node.name) && node.name.text === "value") {
				contexts.push(`${ts.SyntaxKind[function_owner.kind]}:${inside_constructor}`);
			}
		});

		expect(contexts).toEqual(["Constructor:true"]);
	});

	test("collects callable references through the prepared traversal", () => {
		const file = "/virtual/consumer.ts";
		const root = "/virtual";
		const text = "const service = new Service(); service.execute();";
		const ast_file = new TypeScriptAstFile(file, text);
		const source_file = ast_file.source_file_node();
		const traversal = new TypeScriptAstTraversal(source_file);
		const collector = new TypeScriptCallReferenceCollector({
			source_file,
			declaration_index: new TypeScriptObjectAliasDeclarationIndex(),
			project_root: root,
			stage_timer: new LintStageTimer(),
			source_files: new Map([[file, source_file]]),
			traversal,
			source_io: new InMemoryProjectSourceIO(new Map([[file, text]])),
		});

		const references = collector.collect();

		expect(references.map(({ name, is_call }) => ({ name, is_call }))).toEqual([
			{ name: "Service", is_call: false },
			{ name: "execute", is_call: true },
		]);
	});
});
