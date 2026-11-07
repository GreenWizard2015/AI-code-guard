import { describe, expect, test } from "@jest/globals";
import { TypeScriptMemberBinding } from "src/parser/typescript-aliases/members/type_script_member_binding";
import { TypeScriptObjectAliasDeclarationIndex } from "src/parser/typescript-aliases/type_script_object_alias_declaration_index";
import ts from "typescript";

describe("TypeScript member binding cache", () => {
	test("shares ordered declaration lists between bindings without crossing nested function scopes", () => {
		const source_file = ts.createSourceFile(
			"member-binding.ts",
			"const root = this.value; function nested() { const child = this.other; }",
			ts.ScriptTarget.Latest,
			true,
		);
		const declaration_index = new TypeScriptObjectAliasDeclarationIndex();
		const variable_scope = declaration_index.variable_scope(source_file);
		const declarations = variable_scope.member_variable_declarations();
		const reused_declarations = declaration_index.variable_scope(source_file).member_variable_declarations();
		const all_declarations = variable_scope.all_variable_declarations();

		expect({
			list_reused: reused_declarations === declarations,
			declarations: declarations.map((declaration) => declaration.name.getText(source_file)),
			all_declarations: all_declarations.map((declaration) => declaration.name.getText(source_file)),
		}).toEqual({
			list_reused: true,
			declarations: ["root"],
			all_declarations: ["root", "child"],
		});
	});

	test("reuses the resolved aliases for the same AST scope", () => {
		const source_file = ts.createSourceFile(
			"member-binding.ts",
			"const first = this.value; const second = first;",
			ts.ScriptTarget.Latest,
			true,
		);
		const binding = new TypeScriptMemberBinding("this", () => "", new TypeScriptObjectAliasDeclarationIndex());
		const first_result = binding.collect(source_file);
		const second_result = binding.collect(source_file);

		expect(second_result).toBe(first_result);
		expect(second_result.get("first")).toEqual(new Set(["value"]));
	});

	test("keeps aliases for different AST scopes separate", () => {
		const source_file = ts.createSourceFile(
			"member-binding.ts",
			"const first = this.value;",
			ts.ScriptTarget.Latest,
			true,
		);
		const binding = new TypeScriptMemberBinding("this", () => "", new TypeScriptObjectAliasDeclarationIndex());
		const source_result = binding.collect(source_file);
		const statement = source_file.statements.at(0);
		let statement_result = source_result;
		if (statement !== undefined) {
			statement_result = binding.collect(statement);
		}
		let first_binding: Set<string> | undefined;
		if (statement_result !== undefined) {
			first_binding = statement_result.get("first");
		}

		expect({
			statement_exists: statement !== undefined,
			result_is_separate: statement_result !== undefined && statement_result !== source_result,
			first_binding,
		}).toEqual({
			statement_exists: true,
			result_is_separate: true,
			first_binding: new Set(["value"]),
		});
	});
});
