import ts from "typescript";
import { describe, expect, test } from "@jest/globals";
import { TypeScriptMemberBinding } from "src/typescript-aliases/type_script_member_binding";

describe("TypeScript member binding cache", () => {
	test("reuses the resolved aliases for the same AST scope", () => {
		const source_file = ts.createSourceFile(
			"member-binding.ts",
			"const first = this.value; const second = first;",
			ts.ScriptTarget.Latest,
			true,
		);
		const binding = new TypeScriptMemberBinding("this", () => "");
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
		const binding = new TypeScriptMemberBinding("this", () => "");
		const source_result = binding.collect(source_file);
		const statement_result = binding.collect(source_file.statements[0]);

		expect(statement_result).not.toBe(source_result);
		expect(statement_result.get("first")).toEqual(new Set(["value"]));
	});
});
