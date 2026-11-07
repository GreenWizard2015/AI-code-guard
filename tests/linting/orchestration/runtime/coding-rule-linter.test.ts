import { describe, expect, test } from "@jest/globals";
import { SourceText } from "src/io/source_text";
import { LintStageTimer } from "src/lint_stage_timer";
import { CodingRuleLinter } from "src/linting/orchestration/runtime/coding_rule_linter";
import { CodingRuleSourceServicesCache } from "src/linting/orchestration/runtime/coding_rule_source_services_cache";
import { SourceFileAst } from "src/linting/orchestration/runtime/source_file_ast";
import { TypeScriptAstFile } from "src/model/ast/type_script_ast_file";
import { TypeScriptAstTraversal } from "src/parser/analysis/type_script_ast_traversal";
import type { SourceFileResolver } from "src/source_types";
import { EMPTY_PROJECT_NAMES } from "tests/core/constants";
import { ASTVerifierTestContext } from "tests/rules/typescript/syntax-rules/ast/ast_verifier_test_context";

describe("coding rule linter", () => {
	test("reuses all analysis services for the same source resolver", () => {
		const cache = new CodingRuleSourceServicesCache("/repo", false, new SourceText());
		const resolver: SourceFileResolver = new Map();
		const first = cache.for_resolver(resolver);
		const second = cache.for_resolver(resolver);

		expect({
			reused_service_set: first === second,
			reused_module_exports: first.module_exports === second.module_exports,
			reused_source_index: first.source_index === second.source_index,
			reused_node_rules: first.node_rules === second.node_rules,
		}).toEqual({
			reused_service_set: true,
			reused_module_exports: true,
			reused_source_index: true,
			reused_node_rules: true,
		});
	});

	test("runs standalone file diagnostics without project scope", () => {
		const text =
			"const globals = { console };\nglobals.console.log('result');\ntest('result', () => { expect(true).toBe(true); });";
		const parsed_file = new TypeScriptAstFile("tests/object-console.test.ts", text);
		const source_ast = new SourceFileAst(
			{ file: "tests/object-console.test.ts", text },
			parsed_file.normalized(),
			parsed_file.source_file_node(),
			new Map(),
			new TypeScriptAstTraversal(parsed_file.source_file_node()),
		);
		const context = new ASTVerifierTestContext(source_ast.snapshot().source_file);
		const state = context.state();
		const rule_scope = state.project.rule_scope;
		const linter = new CodingRuleLinter(rule_scope, process.cwd(), new SourceText(), EMPTY_PROJECT_NAMES);
		const violations = linter.lint_typescript(source_ast, new LintStageTimer());
		expect(violations.map((item) => item.rule_id()).sort()).toEqual([
			"file-min-size",
			"mixed-module",
			"module-constants-separation",
			"typescript-console-in-test",
			"typescript-jest-describe-count",
			"typescript-module-constant-case",
		]);
	});

	test("rejects parenthesized assertions outside test callbacks", () => {
		const text =
			"expect(value);\n(expect)(value);\nconst check = expect;\ncheck(value);\ntest('result', () => { expect(true).toBe(true); });";
		const parsed_file = new TypeScriptAstFile("tests/example.test.ts", text);
		const source_ast = new SourceFileAst(
			{ file: "tests/example.test.ts", text },
			parsed_file.normalized(),
			parsed_file.source_file_node(),
			new Map(),
			new TypeScriptAstTraversal(parsed_file.source_file_node()),
		);
		const context = new ASTVerifierTestContext(source_ast.snapshot().source_file);
		const state = context.state();
		const rule_scope = state.project.rule_scope;
		const linter = new CodingRuleLinter(rule_scope, process.cwd(), new SourceText(), EMPTY_PROJECT_NAMES);
		const violations = linter.lint_typescript(source_ast, new LintStageTimer());
		const findings = violations
			.filter((item) => item.rule_id() === "assertion-outside-test")
			.map((item) => ({ line: item.line(), message: item.message(), rule_id: item.rule_id() }))
			.sort((left, right) => left.line - right.line);
		expect(findings).toEqual(
			[
				{ line: 1, message: "test assertions must stay inside test cases", rule_id: "assertion-outside-test" },
				{ line: 2, message: "test assertions must stay inside test cases", rule_id: "assertion-outside-test" },
				{ line: 4, message: "test assertions must stay inside test cases", rule_id: "assertion-outside-test" },
			].sort((left, right) => left.line - right.line),
		);
	});
});
