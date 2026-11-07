import { describe, expect, test } from "@jest/globals";
import { TypeScriptVariableDeclarationIndex } from "src/linting/type_script_variable_declaration_index";
import { GETATTR, SETATTR } from "src/parser/internals/constants";
import { TypeScriptObjectAliasDeclarationIndex } from "src/parser/typescript-aliases/type_script_object_alias_declaration_index";
import { CompositeStateTypeRules } from "src/rules/typescript/syntax-rules/types/composite_state_type_rules";
import { NullableTypeRules } from "src/rules/typescript/syntax-rules/types/nullable_type_rules";
import { TypeScriptBoundaryRuleAppender } from "src/rules/typescript/syntax-rules/types/type_script_boundary_rule_appender";
import { ASTVerifierTestContext } from "tests/rules/typescript/syntax-rules/ast/ast_verifier_test_context";
import ts from "typescript";

describe("TypeScript boundary rule appender", () => {
	test("shares cached declarations while resolving getattr and setattr aliases", () => {
		const source_file = ts.createSourceFile(
			"boundary-aliases.ts",
			'const read_member = getattr; const write_member = setattr; read_member(target, "name"); write_member(target, "name", value);',
			ts.ScriptTarget.Latest,
			true,
		);
		const scenario = new ASTVerifierTestContext(source_file);
		const nullable = new NullableTypeRules(new Set());
		const appender = new TypeScriptBoundaryRuleAppender(
			nullable,
			new CompositeStateTypeRules(nullable),
			new TypeScriptVariableDeclarationIndex(),
			new TypeScriptObjectAliasDeclarationIndex(),
		);
		scenario.append_calls(appender);

		expect(scenario.rule_ids()).toEqual([GETATTR, SETATTR]);
	});

	test("reuses one declaration index for direct getattr and setattr calls", () => {
		const source_file = ts.createSourceFile(
			"direct-boundary-calls.ts",
			'getattr(target, "name"); setattr(target, "name", value);',
			ts.ScriptTarget.Latest,
			true,
		);
		const scenario = new ASTVerifierTestContext(source_file);
		const nullable = new NullableTypeRules(new Set());
		const appender = new TypeScriptBoundaryRuleAppender(
			nullable,
			new CompositeStateTypeRules(nullable),
			new TypeScriptVariableDeclarationIndex(),
			new TypeScriptObjectAliasDeclarationIndex(),
		);
		scenario.append_calls(appender);

		expect(scenario.rule_ids()).toEqual([GETATTR, SETATTR]);
	});
});
