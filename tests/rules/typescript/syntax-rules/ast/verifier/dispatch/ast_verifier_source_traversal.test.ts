import { describe, expect, test } from "@jest/globals";
import { ASTVerifierRegistry } from "src/rules/typescript/syntax-rules/ast/verifier/ast_verifier_registry";
import { TypeScriptStateRules } from "src/rules/typescript/syntax-rules/ast/verifier/class-state/type_script_state_rules";
import { ASTVerifier } from "src/rules/typescript/syntax-rules/ast/verifier/dispatch/ast_verifier";
import { TypeScriptFileNamespaceRules } from "src/rules/typescript/syntax-rules/ast/verifier/file-rules/type_script_file_namespace_rules";
import { ASTVerifierTestContext } from "tests/rules/typescript/syntax-rules/ast/ast_verifier_test_context";
import ts from "typescript";

describe(`${ASTVerifier.name} source traversal`, () => {
	test("collects namespace declarations during source traversal", () => {
		const source_text = "namespace Scope {}\nif (true) {}";
		const source_file = ts.createSourceFile("source-root.ts", source_text, ts.ScriptTarget.Latest, true);
		const registry = new ASTVerifierRegistry();
		registry.register(new TypeScriptFileNamespaceRules(), [ts.SyntaxKind.ModuleDeclaration]);
		const verifier = registry.build(source_text);
		const scenario = new ASTVerifierTestContext(source_file);

		verifier.verify_source_file({
			source_root: scenario.state().source.source_file,
			context: scenario,
			stage_timer: scenario.state().analysis.stage_timer,
		});

		expect(scenario.violations().map((violation) => [violation.rule_id(), violation.line()])).toEqual([
			["typescript-namespace-file", 2],
		]);
	});

	test("dispatches registered child kinds below unmatched ancestors and visits siblings", () => {
		const source_text = [
			"if (true) {",
			"  class First {",
			"    public values: string[] = [];",
			"  }",
			"  class Second {",
			"    public values: string[] = [];",
			"  }",
			"}",
		].join("\n");
		const source_file = ts.createSourceFile("registered-children.ts", source_text, ts.ScriptTarget.Latest, true);
		const registry = new ASTVerifierRegistry();
		registry.register(new TypeScriptStateRules(), [ts.SyntaxKind.PropertyDeclaration]);
		const verifier = registry.build(source_text);
		const scenario = new ASTVerifierTestContext(source_file);

		verifier.verify_source_file({
			source_root: scenario.state().source.source_file,
			context: scenario,
			stage_timer: scenario.state().analysis.stage_timer,
		});

		const dispatch_results = scenario
			.violations()
			.map((violation) => `${violation.rule_id()}:${violation.line()}`)
			.sort();
		expect(dispatch_results).toEqual(["public-state-exposure:3", "public-state-exposure:6"].sort());
	});
});
