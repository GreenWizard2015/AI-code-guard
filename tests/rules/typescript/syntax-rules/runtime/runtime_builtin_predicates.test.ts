import { describe, expect, test } from "@jest/globals";
import { TypeScriptObjectAliasDeclarationIndex } from "src/parser/typescript-aliases/type_script_object_alias_declaration_index";
import { RuntimeBuiltinPredicates } from "src/rules/typescript/syntax-rules/runtime/runtime_builtin_predicates";
import ts from "typescript";

describe("runtime built-in predicates", () => {
	test("recognizes direct Reflect prototype mutation", () => {
		const source_file = ts.createSourceFile(
			"prototype.ts",
			"Reflect.setPrototypeOf(value, Object.prototype);",
			ts.ScriptTarget.Latest,
			true,
		);
		const predicates = new RuntimeBuiltinPredicates(new TypeScriptObjectAliasDeclarationIndex());
		let recognized = false;
		for (const statement of source_file.statements) {
			if (ts.isExpressionStatement(statement) && ts.isCallExpression(statement.expression)) {
				recognized = predicates.prototype_assignment(statement.expression);
			}
		}
		expect(recognized).toBe(true);
	});

	test("recognizes a Reflect alias prototype mutation", () => {
		const source_file = ts.createSourceFile(
			"prototype-alias.ts",
			"const runtime = Reflect; runtime.setPrototypeOf(value, Object.prototype);",
			ts.ScriptTarget.Latest,
			true,
		);
		const predicates = new RuntimeBuiltinPredicates(new TypeScriptObjectAliasDeclarationIndex());
		let recognized = false;
		for (const statement of source_file.statements) {
			if (ts.isExpressionStatement(statement) && ts.isCallExpression(statement.expression)) {
				recognized = predicates.prototype_assignment(statement.expression);
			}
		}
		expect(recognized).toBe(true);
	});
});
