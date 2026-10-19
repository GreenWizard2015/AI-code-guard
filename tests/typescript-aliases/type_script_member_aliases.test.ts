import ts from "typescript";
import { describe, expect, test } from "@jest/globals";
import { TypeScriptMemberAliases } from "src/typescript-aliases/type_script_member_aliases";

describe("TypeScript member aliases", () => {
	test("resolves a member alias from its owning scope", () => {
		const source_file = ts.createSourceFile(
			"member-aliases.ts",
			"const value = this.value; value;",
			ts.ScriptTarget.Latest,
			true,
		);
		const aliases = new TypeScriptMemberAliases("this", () => "");
		const expressions = source_file.statements.filter(ts.isExpressionStatement);
		const expression_statement = expressions[0];
		const access = expression_statement.expression;

		expect(aliases.member(access, source_file)).toBe(true);
	});

	test("does not classify unrelated identifiers as member aliases", () => {
		const source_file = ts.createSourceFile(
			"member-aliases.ts",
			"const value = this.value; other;",
			ts.ScriptTarget.Latest,
			true,
		);
		const aliases = new TypeScriptMemberAliases("this", () => "");
		const expressions = source_file.statements.filter(ts.isExpressionStatement);
		const expression_statement = expressions[0];
		const access = expression_statement.expression;

		expect(aliases.member(access, source_file)).toBe(false);
	});
});
