import { describe, expect, test } from "@jest/globals";
import { LintRunConfiguration } from "src/core/lint_run_configuration";
import { SourceText } from "src/source_text";
import { NodeFileIO } from "src/io/node_file_io";
import { COVERAGE_FILES } from "tests/bridge/ts/core/constants";
import { TestFixture } from "tests/core/test-fixture";

describe("Python bridge coverage through TypeScript", () => {
	test("covers Python control flow and annotation branches", () => {
		const fixture = new TestFixture();
		const violations = fixture.with_lint_request(
			new LintRunConfiguration(new SourceText(), new NodeFileIO()),
			COVERAGE_FILES,
			(production_lint_configuration, options, mode) =>
				production_lint_configuration.lint_report(options, mode).report.violations,
		);
		expect({
			conditional: violations.some((item) => item.rule_id === "conditional-execution"),
			ternary: violations.some((item) => item.rule_id === "ternary-expression"),
			undefined: violations.some((item) => item.rule_id === "unnecessary-undefined-check"),
			union: violations.some((item) => item.rule_id === "composite-state-type"),
			assignment_expression: violations.some((item) => item.rule_id === "python-assignment-expression"),
		}).toEqual({ conditional: true, ternary: true, undefined: true, union: true, assignment_expression: true });
	});

	test("covers Python private access and proxy callable branches", () => {
		const fixture = new TestFixture();
		const violations = fixture.with_lint_request(
			new LintRunConfiguration(new SourceText(), new NodeFileIO()),
			COVERAGE_FILES,
			(production_lint_configuration, options, mode) =>
				production_lint_configuration.lint_report(options, mode).report.violations,
		);
		expect({
			private_access: violations.some((item) => item.rule_id === "private-member"),
			proxy_callable: violations.some((item) => item.rule_id === "proxy-callable"),
			proxy_lambda: violations.some((item) => item.rule_id === "proxy-lambda"),
		}).toEqual({ private_access: true, proxy_callable: true, proxy_lambda: true });
	});

	test("covers Python constructor, class metadata, and precedence branches", () => {
		const fixture = new TestFixture();
		const violations = fixture.with_lint_request(
			new LintRunConfiguration(new SourceText(), new NodeFileIO()),
			COVERAGE_FILES,
			(production_lint_configuration, options, mode) =>
				production_lint_configuration.lint_report(options, mode).report.violations,
		);
		expect({
			constructor: violations.some((item) => item.rule_id === "complex-constructor"),
			boolean_precedence: violations.some((item) => item.rule_id === "mixed-boolean-precedence"),
			arithmetic_precedence: violations.some((item) => item.rule_id === "mixed-arithmetic-precedence"),
			single_array: violations.some((item) => item.rule_id === "single-item-array-state"),
		}).toEqual({ constructor: true, boolean_precedence: true, arithmetic_precedence: true, single_array: true });
	});
});
