import { describe, expect, test } from "@jest/globals";
import { TypeScriptMemberAliases } from "src/parser/typescript-aliases/type_script_member_aliases";
import { TypeScriptObjectAliasDeclarationIndex } from "src/parser/typescript-aliases/type_script_object_alias_declaration_index";
import ts from "typescript";

describe("TypeScript member aliases", () => {
	test("resolves a member alias from its owning scope", () => {
		const source_file = ts.createSourceFile(
			"member-aliases.ts",
			"const value = this.value; value;",
			ts.ScriptTarget.Latest,
			true,
		);
		const aliases = new TypeScriptMemberAliases("this", () => "", new TypeScriptObjectAliasDeclarationIndex());
		const expression_statement = source_file.statements.at(1);
		let is_member_alias = false;
		if (expression_statement !== undefined && ts.isExpressionStatement(expression_statement)) {
			is_member_alias = aliases.member({ expression: expression_statement.expression, node: source_file });
		}

		expect(is_member_alias).toBe(true);
	});

	test("does not classify unrelated identifiers as member aliases", () => {
		const source_file = ts.createSourceFile(
			"member-aliases.ts",
			"const value = this.value; other;",
			ts.ScriptTarget.Latest,
			true,
		);
		const aliases = new TypeScriptMemberAliases("this", () => "", new TypeScriptObjectAliasDeclarationIndex());
		const expression_statement = source_file.statements.at(1);
		let is_member_alias = true;
		if (expression_statement !== undefined && ts.isExpressionStatement(expression_statement)) {
			is_member_alias = aliases.member({ expression: expression_statement.expression, node: source_file });
		}

		expect(is_member_alias).toBe(false);
	});

	test("keeps cached aliases scoped to their owning function", () => {
		const source_file = ts.createSourceFile(
			"member-aliases.ts",
			[
				"function first_scope() { const value = this.value; value; }",
				"function second_scope() { const value = other.value; value; }",
			].join("\n"),
			ts.ScriptTarget.Latest,
			true,
		);
		const aliases = new TypeScriptMemberAliases("this", () => "", new TypeScriptObjectAliasDeclarationIndex());
		const functions = source_file.statements.filter(ts.isFunctionDeclaration);
		const first_body = functions[0]?.body;
		const second_body = functions[1]?.body;
		const first_use = first_body?.statements[1];
		const second_use = second_body?.statements[1];
		let first_scope = false;
		let second_scope = false;
		if (first_use !== undefined && ts.isExpressionStatement(first_use)) {
			first_scope = aliases.member({ expression: first_use.expression, node: first_use });
		}
		if (second_use !== undefined && ts.isExpressionStatement(second_use)) {
			second_scope = aliases.member({ expression: second_use.expression, node: second_use });
		}

		expect({ first_scope, second_scope }).toEqual({ first_scope: true, second_scope: false });
	});
});
