import { describe, expect, test } from "@jest/globals";
import { TypeScriptStoredAliasDeclarationIndex } from "src/parser/analysis/type_script_stored_alias_declaration_index";
import { TypeScriptStoredBindAlias } from "src/parser/analysis/type_script_stored_bind_alias";
import { TypeScriptMemberAliases } from "src/parser/typescript-aliases/type_script_member_aliases";
import { TypeScriptObjectAliasDeclarationIndex } from "src/parser/typescript-aliases/type_script_object_alias_declaration_index";
import ts from "typescript";

describe("TypeScript stored bind aliases", () => {
	test("recognizes a stored bind alias for a parsed source file", () => {
		const source = ts.createSourceFile(
			"sample.ts",
			"const bound = target.bind;\nbound.call(target);",
			ts.ScriptTarget.Latest,
			true,
		);
		const calls = source.statements
			.filter(ts.isExpressionStatement)
			.map((statement) => statement.expression)
			.filter(ts.isCallExpression);
		const rule = new TypeScriptStoredBindAlias(new TypeScriptStoredAliasDeclarationIndex());
		const member_aliases = new TypeScriptMemberAliases("bind", () => "", new TypeScriptObjectAliasDeclarationIndex());
		const results = calls.map((call) => rule.matches(call, call.expression, member_aliases, () => ""));
		const repeated_results = calls.map((call) => rule.matches(call, call.expression, member_aliases, () => ""));

		expect({ results, repeated_results }).toEqual({ results: [true], repeated_results: [true] });
	});

	test("does not classify an unrelated stored member as bind", () => {
		const source = ts.createSourceFile(
			"sample.ts",
			"const stored = target.execute;\nstored.call(target);",
			ts.ScriptTarget.Latest,
			true,
		);
		const calls = source.statements
			.filter(ts.isExpressionStatement)
			.map((statement) => statement.expression)
			.filter(ts.isCallExpression);
		const rule = new TypeScriptStoredBindAlias(new TypeScriptStoredAliasDeclarationIndex());
		const member_aliases = new TypeScriptMemberAliases("bind", () => "", new TypeScriptObjectAliasDeclarationIndex());
		const results = calls.map((call) => rule.matches(call, call.expression, member_aliases, () => ""));

		expect(results).toEqual([false]);
	});
});
