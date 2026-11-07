import { describe, expect, test } from "@jest/globals";
import { TypeScriptAstFile } from "src/model/ast/type_script_ast_file";
import { ASTVerifierRegistry } from "src/rules/typescript/syntax-rules/ast/verifier/ast_verifier_registry";
import { TypeScriptModuleDeclarationNaming } from "src/rules/typescript/syntax-rules/ast/verifier/declaration-rules/type_script_module_declaration_naming";
import { ASTVerifierTestContext } from "tests/rules/typescript/syntax-rules/ast/ast_verifier_test_context";

describe("TypeScript module declaration naming", () => {
	/** Responsibilities: _module declaration analysis_. **/
	const lint = (text: string): readonly string[] => {
		const source = new TypeScriptAstFile("source.ts", text);
		const registry = new ASTVerifierRegistry();
		registry.initialize();
		const context = new ASTVerifierTestContext(source.source_file_node());
		context.append_tree(registry.build(text));
		return context.rule_ids();
	};

	test("requires uppercase constants and forbids module variables", () => {
		const text = [
			"const VALID_NAME = 1;",
			"const invalid_name = 2;",
			"export const exported_name = 3;",
			"let mutable_name = 4;",
			"export var exported_mutable_name = 5;",
			"function local_state() { const local_name = 6; return local_name; }",
		].join("\n");
		const naming_rule = new TypeScriptModuleDeclarationNaming();
		const active = naming_rule.active_for(text);
		const rule_ids = lint(text);
		const constant_case_violations = rule_ids.filter((id) => id === "typescript-module-constant-case");
		const module_variable_violations = rule_ids.filter((id) => id === "typescript-module-variable");

		expect({
			active,
			constant_case: constant_case_violations.length,
			module_variable: module_variable_violations.length,
		}).toEqual({ active: true, constant_case: 2, module_variable: 2 });
	});

	test("allows uppercase module constants and local mutable state", () => {
		const text = [
			"export const VALID_NAME = 1;",
			"function local_state() { let local_name = 2; return local_name; }",
		].join("\n");
		const naming_rule = new TypeScriptModuleDeclarationNaming();
		const active = naming_rule.active_for(text);
		const rule_ids = lint(text);

		const naming_violations = rule_ids.filter(
			(id) => id === "typescript-module-constant-case" || id === "typescript-module-variable",
		);
		expect({ active, naming_violations }).toEqual({ active: true, naming_violations: [] });
	});

	test("checks destructured module constants", () => {
		const text = [
			"const SOURCE = { badValue: 1 };",
			"const { badValue } = SOURCE;",
			"const [anotherBadValue] = [badValue];",
		].join("\n");
		const naming_rule = new TypeScriptModuleDeclarationNaming();
		const active = naming_rule.active_for(text);
		const rule_ids = lint(text);

		const constant_case_violations = rule_ids.filter((id) => id === "typescript-module-constant-case");
		expect({ active, constant_case_count: constant_case_violations.length }).toEqual({
			active: true,
			constant_case_count: 2,
		});
	});
});
