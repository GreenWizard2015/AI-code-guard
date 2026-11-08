import assert from "node:assert/strict";
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

	test("resolves a member alias inside its owning function", () => {
		const source_file = ts.createSourceFile(
			"member-aliases.ts",
			"function first_scope() { const value = this.value; value; }",
			ts.ScriptTarget.Latest,
			true,
		);
		const aliases = new TypeScriptMemberAliases("this", () => "", new TypeScriptObjectAliasDeclarationIndex());
		const declaration = source_file.statements[0];
		assert.ok(declaration);
		assert.ok(ts.isFunctionDeclaration(declaration));
		assert.ok(declaration.body);
		const use = declaration.body.statements[1];
		assert.ok(use);
		assert.ok(ts.isExpressionStatement(use));
		const member_alias = aliases.member({ expression: use.expression, node: use });

		expect(member_alias).toBe(true);
	});

	test("does not reuse a member alias in a sibling function", () => {
		const source_file = ts.createSourceFile(
			"member-aliases.ts",
			[
				"function first_scope() { const value = this.value; value; }",
				"function second_scope() { const value = other.value; value; }",
			].join(" "),
			ts.ScriptTarget.Latest,
			true,
		);
		const functions = source_file.statements.filter(ts.isFunctionDeclaration);
		const first_function = functions[0];
		const second_function = functions[1];
		assert.ok(first_function !== undefined && second_function !== undefined);
		assert.ok(first_function.body !== undefined && second_function.body !== undefined);
		const first_use = first_function.body.statements[1];
		const second_use = second_function.body.statements[1];
		assert.ok(first_use !== undefined && second_use !== undefined);
		assert.ok(ts.isExpressionStatement(first_use) && ts.isExpressionStatement(second_use));
		const aliases = new TypeScriptMemberAliases("this", () => "", new TypeScriptObjectAliasDeclarationIndex());
		const first_scope = aliases.member({ expression: first_use.expression, node: first_use });
		const second_scope = aliases.member({ expression: second_use.expression, node: second_use });

		expect({ first_scope, second_scope }).toEqual({ first_scope: true, second_scope: false });
	});
});
