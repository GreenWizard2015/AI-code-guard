import { describe, expect, test } from "@jest/globals";
import { TypeScriptModuleDeclarationNaming } from "src/linting/orchestration/runtime/typescript-rule-groups/special-rules/type_script_module_declaration_naming";
import { TypeScriptAstFile } from "src/model/ast/type_script_ast_file";
import type { ViolationContract } from "src/protocols";

describe("TypeScript module declaration naming", () => {
	test("requires uppercase constants and forbids module variables", () => {
		const source = new TypeScriptAstFile(
			"source.ts",
			[
				"const VALID_NAME = 1;",
				"const invalid_name = 2;",
				"export const exported_name = 3;",
				"let mutable_name = 4;",
				"export var exported_mutable_name = 5;",
				"function local_state() { const local_name = 6; return local_name; }",
			].join("\n"),
		);
		const violations: ViolationContract[] = [];
		const naming = new TypeScriptModuleDeclarationNaming();
		naming.append_constants(violations, "source.ts", source.normalized().named_symbols);
		naming.append_variables(violations, "source.ts", source.normalized().named_symbols);

		expect(violations).toEqual(
			expect.arrayContaining([
				expect.objectContaining({
					rule_id: "typescript-module-constant-case",
					message: 'module-level constant "invalid_name" must use UPPER_SNAKE_CASE',
				}),
				expect.objectContaining({
					rule_id: "typescript-module-constant-case",
					message: 'module-level constant "exported_name" must use UPPER_SNAKE_CASE',
				}),
				expect.objectContaining({
					rule_id: "typescript-module-variable",
					message: 'module-level variable "mutable_name" is not allowed',
				}),
				expect.objectContaining({
					rule_id: "typescript-module-variable",
					message: 'module-level variable "exported_mutable_name" is not allowed',
				}),
			]),
		);
		expect(violations).not.toEqual(
			expect.arrayContaining([
				expect.objectContaining({
					rule_id: "typescript-module-constant-case",
					message: expect.stringContaining('"VALID_NAME"'),
				}),
				expect.objectContaining({
					rule_id: "typescript-module-variable",
					message: expect.stringContaining('"local_name"'),
				}),
			]),
		);
	});

	test("allows uppercase module constants and local mutable state", () => {
		const source = new TypeScriptAstFile(
			"source.ts",
			["export const VALID_NAME = 1;", "function local_state() { let local_name = 2; return local_name; }"].join("\n"),
		);
		const violations: ViolationContract[] = [];
		const naming = new TypeScriptModuleDeclarationNaming();
		naming.append_constants(violations, "source.ts", source.normalized().named_symbols);
		naming.append_variables(violations, "source.ts", source.normalized().named_symbols);

		expect(
			violations.filter(
				(violation) =>
					violation.rule_id === "typescript-module-constant-case" || violation.rule_id === "typescript-module-variable",
			),
		).toEqual([]);
	});

	test("checks destructured module constants", () => {
		const source = new TypeScriptAstFile(
			"constants.ts",
			["const SOURCE = { badValue: 1 };", "const { badValue } = SOURCE;", "const [anotherBadValue] = [badValue];"].join(
				"\n",
			),
		);
		const violations: ViolationContract[] = [];
		const naming = new TypeScriptModuleDeclarationNaming();
		naming.append_constants(violations, "constants.ts", source.normalized().named_symbols);
		naming.append_variables(violations, "constants.ts", source.normalized().named_symbols);
		const constant_violations = violations.filter(
			(violation) => violation.rule_id === "typescript-module-constant-case",
		);
		expect(constant_violations.map((violation) => violation.message)).toEqual([
			'module-level constant "badValue" must use UPPER_SNAKE_CASE',
			'module-level constant "anotherBadValue" must use UPPER_SNAKE_CASE',
		]);
	});
});
