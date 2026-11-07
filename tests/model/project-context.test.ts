import "src/core/lint_project_context_creator";
import { LintRunConfiguration } from "src/core/lint_run_configuration";
import { NodeFileIO } from "src/io/node_file_io";
import { SourceText } from "src/io/source_text";
import { ASTVerifierTestContext } from "tests/rules/typescript/syntax-rules/ast/ast_verifier_test_context";
import "src/lint_stage_timer";
import { describe, expect, test } from "@jest/globals";
import { RULE_DOCUMENT_PATHS_BY_ID, RULE_LANGUAGE_BY_ID } from "src/constants";
import { PythonSourceFiles } from "src/core/context/python_source_files";
import { LintStageTimer } from "src/lint_stage_timer";
import { CodingRuleLinter } from "src/linting/orchestration/runtime/coding_rule_linter";
import { SourceFileAst } from "src/linting/orchestration/runtime/source_file_ast";
import { TypeScriptAstFile } from "src/model/ast/type_script_ast_file";
import { DiagnosticRule } from "src/model/diagnostic_rule";
import { TypeScriptAstTraversal } from "src/parser/analysis/type_script_ast_traversal";
import type { RuleContract } from "src/reporting_protocols";
import { EMPTY_PROJECT_NAMES } from "tests/core/constants";
import { TestFixture } from "tests/core/test-fixture";

describe("coding lint rule contracts", () => {
	test("exposes coding rules through the RuleContract interface", () => {
		const rule: RuleContract = new DiagnosticRule("typescript-console-mock-in-test");
		const expected_violation = rule.violation("fixture.ts", 1, {});
		const contract_violation = rule.violation("fixture.ts", 1, {});
		expect({
			contract_result: [contract_violation.message(), contract_violation.hint(), contract_violation.rule_id()],
			created_result: [expected_violation.message(), expected_violation.hint(), expected_violation.rule_id()],
		}).toEqual({
			contract_result: [
				"do not mock console in tests",
				"assert the returned value or collected diagnostics directly. Do not: mock console methods to verify behavior.",
				"typescript-console-mock-in-test",
			],
			created_result: [
				"do not mock console in tests",
				"assert the returned value or collected diagnostics directly. Do not: mock console methods to verify behavior.",
				"typescript-console-mock-in-test",
			],
		});
	});

	test("renders message templates when creating violations", () => {
		const rule = new DiagnosticRule("class-size");
		const violation = rule.violation("fixture.ts", 3, { count: "4" });
		expect({
			file: violation.file(),
			line: violation.line(),
			message: violation.message(),
			hint: violation.hint(),
			rule_id: violation.rule_id(),
			priority: violation.priority(),
		}).toEqual({
			file: "fixture.ts",
			line: 3,
			message: "class has too many methods (found 4)",
			hint: expect.stringContaining("split the class"),
			rule_id: "class-size",
			priority: 3,
		});
	});

	test("accepts each language-specific rule for its source language", () => {
		const python_rule = new DiagnosticRule("python-test-shape");
		const typescript_rule = new DiagnosticRule("typescript-in-operator");
		expect({
			python_result: python_rule.violation("tests/example_test.py", 1).rule_id(),
			typescript_result: typescript_rule.violation("src/example.ts", 1).rule_id(),
		}).toEqual({
			python_result: "python-test-shape",
			typescript_result: "typescript-in-operator",
		});
	});

	test("uses the registry scope to resolve shared and language-specific rule documents", () => {
		const shared_rule = new DiagnosticRule("explicit-return-type");
		const python_rule = new DiagnosticRule("python-test-shape");
		const typescript_rule = new DiagnosticRule("typescript-in-operator");
		expect({
			typescript_language: RULE_LANGUAGE_BY_ID.get("typescript-in-operator"),
			python_language: RULE_LANGUAGE_BY_ID.get("python-test-shape"),
			shared_language: RULE_LANGUAGE_BY_ID.get("explicit-return-type"),
			typescript_path: RULE_DOCUMENT_PATHS_BY_ID.get("typescript-in-operator"),
			python_path: RULE_DOCUMENT_PATHS_BY_ID.get("python-test-shape"),
			shared_paths: RULE_DOCUMENT_PATHS_BY_ID.get("explicit-return-type"),
			shared_typescript_result: shared_rule.violation("source.ts", 1).rule_id(),
			shared_python_result: shared_rule.violation("source.py", 1).rule_id(),
			python_support: [python_rule.supports_file("source.py"), python_rule.supports_file("source.ts")],
			typescript_support: [typescript_rule.supports_file("source.ts"), typescript_rule.supports_file("source.py")],
		}).toEqual({
			typescript_language: "typescript",
			python_language: "python",
			shared_language: undefined,
			typescript_path: ["docs/rules/typescript/in-operator.md"],
			python_path: ["docs/rules/python/test-shape.md"],
			shared_paths: ["docs/rules/typescript/explicit-return-type.md", "docs/rules/python/explicit-return-type.md"],
			shared_typescript_result: "explicit-return-type",
			shared_python_result: "explicit-return-type",
			python_support: [true, false],
			typescript_support: [true, false],
		});
	});

	test("uses distinct rule IDs for informational and warning variants", () => {
		const info_rule = new DiagnosticRule("type-info");
		const warning_rule = new DiagnosticRule("type-warning");
		const info = info_rule.violation("fixture.ts", 1, { subject: "return type", type: "unknown" });
		const warning = warning_rule.violation("fixture.ts", 2, { subject: 'field "value"', type: "unknown" });
		expect([info.rule_id(), info.priority()]).toEqual(["type-info", 5]);
		expect([warning.rule_id(), warning.priority()]).toEqual(["type-warning", 5]);
	});

	test("recognizes Python files regardless of suffix case", () => {
		const test_fixture = new TestFixture();
		const python_ast_data = test_fixture.python_ast_data();
		const source_files = new PythonSourceFiles([], new Map(), python_ast_data);
		expect({
			lowercase: source_files.supports("registry.py"),
			uppercase: source_files.supports("registry.PY"),
		}).toEqual({ lowercase: true, uppercase: true });
	});

	test("rejects console mocks in tests", () => {
		const text =
			"const output = jest.spyOn(console, 'warn');\njest[(\"spyOn\")](console, 'warn');\nconst spy = jest.spyOn;\nspy(console, 'warn');\ntest('output', () => { expect(output).toBeDefined(); });";
		const source = new TypeScriptAstFile("tests/example.test.ts", text);
		const source_ast = new SourceFileAst(
			{ file: "tests/example.test.ts", text },
			source.normalized(),
			source.source_file_node(),
			new Map(),
			new TypeScriptAstTraversal(source.source_file_node()),
		);
		const source_snapshot = source_ast.snapshot();
		const test_context = new ASTVerifierTestContext(source_snapshot.source_file);
		const context_state = test_context.state();
		const rule_scope = context_state.project.rule_scope;
		const linter = new CodingRuleLinter(rule_scope, process.cwd(), new SourceText(), EMPTY_PROJECT_NAMES);
		const violations = linter.lint_typescript(source_ast, new LintStageTimer());
		const findings = violations
			.map((item) => ({ line: item.line(), message: item.message(), rule_id: item.rule_id() }))
			.filter(({ rule_id }) => rule_id === "runtime-patching" || rule_id === "typescript-console-mock-in-test")
			.sort((left, right) => left.line - right.line || left.rule_id.localeCompare(right.rule_id));
		expect(findings).toEqual(
			[
				{ line: 1, message: "do not patch or replace existing behavior", rule_id: "runtime-patching" },
				{ line: 1, message: "do not mock console in tests", rule_id: "typescript-console-mock-in-test" },
				{ line: 2, message: "do not mock console in tests", rule_id: "typescript-console-mock-in-test" },
				{ line: 4, message: "do not patch or replace existing behavior", rule_id: "runtime-patching" },
				{ line: 4, message: "do not mock console in tests", rule_id: "typescript-console-mock-in-test" },
			].sort((left, right) => left.line - right.line || left.rule_id.localeCompare(right.rule_id)),
		);
	});

	test("keeps implementation classes forbidden at the project type boundary", () => {
		const fixture = new TestFixture();
		const violations = fixture.with_lint_request(
			new LintRunConfiguration(new SourceText(), new NodeFileIO(process.cwd())),
			{
				"user.ts": 'export class User { public value(): string { return ""; } }\n',
				"consumer.ts": "export function consume(user: User): void { void user; }\n",
			},
			(production_lint_configuration, options, mode) =>
				production_lint_configuration.lint_report(options, mode).report.violations,
		);
		expect(violations.some((item) => item.rule_id() === "project-type-boundary")).toBe(true);
	});

	test("rejects direct console usage in tests", () => {
		const text =
			"console.log('result');\nconsole[\"log\"]('result');\nconst write = console.log;\nwrite('result');\ntest('result', () => { expect(true).toBe(true); });";
		const source = new TypeScriptAstFile("tests/example.test.ts", text);
		const source_ast = new SourceFileAst(
			{ file: "tests/example.test.ts", text },
			source.normalized(),
			source.source_file_node(),
			new Map(),
			new TypeScriptAstTraversal(source.source_file_node()),
		);
		const source_snapshot = source_ast.snapshot();
		const test_context = new ASTVerifierTestContext(source_snapshot.source_file);
		const context_state = test_context.state();
		const rule_scope = context_state.project.rule_scope;
		const linter = new CodingRuleLinter(rule_scope, process.cwd(), new SourceText(), EMPTY_PROJECT_NAMES);
		const violations = linter.lint_typescript(source_ast, new LintStageTimer());
		const findings = violations
			.map((item) => ({ line: item.line(), message: item.message(), rule_id: item.rule_id() }))
			.filter(
				({ rule_id }) => rule_id === "typescript-console-in-test" || rule_id === "typescript-literal-object-access",
			)
			.sort((left, right) => left.line - right.line || left.rule_id.localeCompare(right.rule_id));
		expect(findings).toEqual(
			[
				{ line: 1, message: "do not use console in tests", rule_id: "typescript-console-in-test" },
				{ line: 2, message: "do not use console in tests", rule_id: "typescript-console-in-test" },
				{ line: 2, message: "object access uses a string literal key", rule_id: "typescript-literal-object-access" },
				{ line: 4, message: "do not use console in tests", rule_id: "typescript-console-in-test" },
			].sort((left, right) => left.line - right.line || left.rule_id.localeCompare(right.rule_id)),
		);
	});
});
