import "src/core/lint_project_context_creator";
import { LintRunConfiguration } from "src/core/lint_run_configuration";
import { SourceText } from "src/source_text";
import { NodeFileIO } from "src/io/node_file_io";
import "src/lint_stage_timer";
import { TestFixture } from "tests/core/test-fixture";
import { DiagnosticRule } from "src/model/diagnostic_rule";
import { RULE_DOCUMENT_PATHS_BY_ID, RULE_LANGUAGE_BY_ID } from "src/constants";
import { RULES_BY_ID } from "src/model/constants";
import { CodingRuleLinter } from "src/linting/orchestration/runtime/coding_rule_linter";
import { LintStageTimer } from "src/lint_stage_timer";
import { SourceFileAst } from "src/linting/orchestration/runtime/source_file_ast";
import { TypeScriptAstFile } from "src/model/ast/type_script_ast_file";
import { PythonSourceFiles } from "src/core/context/python_source_files";
import { describe, expect, test } from "@jest/globals";

describe("coding lint rule contracts", () => {
	test("exposes coding rules through the RuleContract interface", () => {
		const rule = RULES_BY_ID.get("typescript-console-mock-in-test");
		const diagnostic_rule = new DiagnosticRule("typescript-console-mock-in-test");
		const expected_violation = diagnostic_rule.violation("fixture.ts", 1, {});
		expect({
			exists: rule !== undefined,
			contract_result: rule?.violation("fixture.ts", 1, {}),
			created_result: expected_violation,
		}).toEqual({
			exists: true,
			contract_result: expected_violation,
			created_result: expect.objectContaining({
				message: "do not mock console in tests",
				hint: expect.stringContaining("assert the returned value"),
				rule_id: "typescript-console-mock-in-test",
			}),
		});
	});

	test("renders message templates when creating violations", () => {
		const rule = new DiagnosticRule("class-size");
		expect(rule.violation("fixture.ts", 3, { count: "4" })).toEqual({
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
			python_result: python_rule.violation("tests/example_test.py", 1).rule_id,
			typescript_result: typescript_rule.violation("src/example.ts", 1).rule_id,
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
			shared_typescript_result: shared_rule.violation("source.ts", 1).rule_id,
			shared_python_result: shared_rule.violation("source.py", 1).rule_id,
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

	test("rejects creating a diagnostic for the wrong source language", () => {
		const python_rule = new DiagnosticRule("python-test-shape");
		const typescript_rule = new DiagnosticRule("typescript-in-operator");
		let python_rejection = "";
		try {
			python_rule.violation("source.ts", 1, {});
		} catch (error) {
			python_rejection = String(error);
		}
		let typescript_rejection = "";
		try {
			typescript_rule.violation("source.py", 1, {});
		} catch (error) {
			typescript_rejection = String(error);
		}

		expect({ python_rejection, typescript_rejection }).toEqual({
			python_rejection: 'Error: Rule "python-test-shape" is registered for python, not typescript.',
			typescript_rejection: 'Error: Rule "typescript-in-operator" is registered for typescript, not python.',
		});
	});

	test("uses distinct rule IDs for informational and warning variants", () => {
		const info_rule = new DiagnosticRule("type-info");
		const warning_rule = new DiagnosticRule("type-warning");
		const info = info_rule.violation("fixture.ts", 1, { subject: "return type", type: "unknown" });
		const warning = warning_rule.violation("fixture.ts", 2, { subject: 'field "value"', type: "unknown" });
		expect(info).toEqual(expect.objectContaining({ rule_id: "type-info", priority: 5 }));
		expect(warning).toEqual(expect.objectContaining({ rule_id: "type-warning", priority: 5 }));
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
			source.source_file,
			new Map(),
			source.traversal,
		);
		const linter = new CodingRuleLinter(process.cwd(), new SourceText());
		const violations = linter.lint_typescript(source_ast, new LintStageTimer());
		expect(violations).toEqual([
			expect.objectContaining({
				line: 1,
				message: "do not mock console in tests",
				rule_id: "typescript-console-mock-in-test",
			}),
			expect.objectContaining({
				line: 2,
				message: "do not mock console in tests",
				rule_id: "typescript-console-mock-in-test",
			}),
			expect.objectContaining({
				line: 4,
				message: "do not mock console in tests",
				rule_id: "typescript-console-mock-in-test",
			}),
		]);
	});

	test("keeps implementation classes forbidden at the project type boundary", () => {
		const fixture = new TestFixture();
		const violations = fixture.with_lint_request(
			new LintRunConfiguration(new SourceText(), new NodeFileIO()),
			{
				"user.ts": 'export class User { public value(): string { return ""; } }\n',
				"consumer.ts": "export function consume(user: User): void { void user; }\n",
			},
			(production_lint_configuration, options, mode) =>
				production_lint_configuration.lint_report(options, mode).report.violations,
		);
		expect(violations.some((item) => item.rule_id === "project-type-boundary")).toBe(true);
	});

	test("rejects direct console usage in tests", () => {
		const text =
			"console.log('result');\nconsole[\"log\"]('result');\nconst write = console.log;\nwrite('result');\ntest('result', () => { expect(true).toBe(true); });";
		const source = new TypeScriptAstFile("tests/example.test.ts", text);
		const source_ast = new SourceFileAst(
			{ file: "tests/example.test.ts", text },
			source.normalized(),
			source.source_file,
			new Map(),
			source.traversal,
		);
		const linter = new CodingRuleLinter(process.cwd(), new SourceText());
		const violations = linter.lint_typescript(source_ast, new LintStageTimer());
		expect(violations).toEqual([
			expect.objectContaining({
				line: 1,
				message: "do not use console in tests",
				rule_id: "typescript-console-in-test",
			}),
			expect.objectContaining({
				line: 2,
				message: "do not use console in tests",
				rule_id: "typescript-console-in-test",
			}),
			expect.objectContaining({
				line: 4,
				message: "do not use console in tests",
				rule_id: "typescript-console-in-test",
			}),
		]);
	});
});
