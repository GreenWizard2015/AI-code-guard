import { describe, expect, test } from "@jest/globals";
import { TypeScriptClassMembers } from "src/parser/analysis/type_script_class_members";
import { ASTVerifierRegistry } from "src/rules/typescript/syntax-rules/ast/verifier/ast_verifier_registry";
import { ASTVerifierTestContext } from "tests/rules/typescript/syntax-rules/ast/ast_verifier_test_context";
import ts from "typescript";

describe("TypeScript class summary AST verification", () => {
	test("does not report implementation classes for a contract module", () => {
		const text = "export interface ReaderContract { read(): string; }";
		const source_file = ts.createSourceFile("protocols.ts", text, ts.ScriptTarget.Latest, true);
		const registry = new ASTVerifierRegistry();
		registry.initialize();
		const scenario = new ASTVerifierTestContext(source_file);
		scenario.append_tree(registry.build(text));

		expect(scenario.rule_ids()).not.toContain("top-level-classes");
	});

	test("does not report classes for an empty source", () => {
		const source_file = ts.createSourceFile("empty.ts", "", ts.ScriptTarget.Latest, true);
		const registry = new ASTVerifierRegistry();
		registry.initialize();
		const scenario = new ASTVerifierTestContext(source_file);
		scenario.append_tree(registry.build(source_file.text));

		expect(scenario.rule_ids()).not.toContain("top-level-classes");
	});

	test("normalizes class field type and modifiers together", () => {
		const source_file = ts.createSourceFile(
			"fields.ts",
			"class Fields { private readonly label: string = ''; protected static count: number = 0; }",
			ts.ScriptTarget.Latest,
			true,
		);
		const members = new TypeScriptClassMembers(source_file);
		const fields = source_file.statements
			.filter(ts.isClassDeclaration)
			.flatMap((class_node) => members.class_fields(class_node));

		expect(
			fields.map((field) => [field.name, field.type, field.visibility, field.readonly, field.class_variable]),
		).toEqual([
			["label", "string", "private", true, false],
			["count", "number", "protected", false, true],
		]);
	});
});
