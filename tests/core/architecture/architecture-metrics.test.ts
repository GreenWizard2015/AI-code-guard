import { TestFixture } from "tests/core/test-fixture";
import { LintRunConfiguration } from "src/core/lint_run_configuration";
import { SourceText } from "src/source_text";
import { NodeFileIO } from "src/io/node_file_io";
import { describe, expect, test } from "@jest/globals";

import { CALLABLE_LIMIT_FILES, SHORT_CLASS_FILES } from "tests/core/constants";

describe("coding-lint architecture and metrics rules", () => {
	test("counts code after a single-line block comment", () => {
		const test_fixture = new TestFixture();

		const source_lines = [
			"/** A module comment. */",
			...Array.from({ length: 30 }, (_, index) => `export const value${index} = ${index};`),
		];
		const source = source_lines.join("\n");
		const violations = test_fixture.with_lint_request(
			new LintRunConfiguration(new SourceText(), new NodeFileIO()),
			{ "commented.ts": source },
			(production_lint_configuration, options, mode) =>
				production_lint_configuration.lint_report(options, mode).report.violations,
		);

		expect(violations).not.toEqual(
			expect.arrayContaining([
				expect.objectContaining({
					file: "commented.ts",
					message: "file is too short",
				}),
			]),
		);
	});

	test("applies the raw maximum file size to test files", () => {
		const test_fixture = new TestFixture();

		const source = Array.from({ length: 501 }, (_, index) => `const value${index} = ${index};`).join("\n");
		const violations = test_fixture.with_lint_request(
			new LintRunConfiguration(new SourceText(), new NodeFileIO()),
			{
				"tests/large.test.ts": source,
			},
			(production_lint_configuration, options, mode) =>
				production_lint_configuration.lint_report(options, mode).report.violations,
		);

		expect(violations).toContainEqual(
			expect.objectContaining({
				message: "file is too large (found 501 raw lines)",
				rule_id: "file-max-size",
				priority: 3,
			}),
		);
	});

	test("reports file, class, method, function, and argument limits", () => {
		const test_fixture = new TestFixture();
		const violations = test_fixture.with_lint_request(
			new LintRunConfiguration(new SourceText(), new NodeFileIO()),
			CALLABLE_LIMIT_FILES,
			(production_lint_configuration, options, mode) =>
				production_lint_configuration.lint_report(options, mode).report.violations,
		);
		const messages = violations.map((item) => item.message);

		expect(messages).toEqual(
			expect.arrayContaining([
				"file is too short",
				"class is too short",
				"method is too short",
				"function has too many arguments (found 6)",
				'functions share class-like prefix "_Agent_" (2 functions)',
				'functions share class-like prefix "_Worker_" (2 functions)',
				'functions share class-like prefix "_Dispatcher_" (2 functions)',
			]),
		);
	});

	test("does not apply callable size limits to test files", () => {
		const test_fixture = new TestFixture();

		const violations = test_fixture.with_lint_request(
			new LintRunConfiguration(new SourceText(), new NodeFileIO()),
			{
				"tests/short.test.ts": "export function short_test_helper() { return 1; }",
				"tests/short_test.py": "def short_test_helper():\n    return 1",
			},
			(production_lint_configuration, options, mode) =>
				production_lint_configuration.lint_report(options, mode).report.violations,
		);
		const messages = violations.map((item) => item.message);

		expect(messages.some((message) => message.includes("function has"))).toBe(false);
		expect(messages.some((message) => message.includes("method has"))).toBe(false);
	});

	test("allows short functions that only raise or throw", () => {
		const test_fixture = new TestFixture();

		const violations = test_fixture.with_lint_request(
			new LintRunConfiguration(new SourceText(), new NodeFileIO()),
			{
				"errors.ts":
					'function fail(): never { throw new Error("this is a deliberately long failure message that exceeds the normal callable character allowance for the test and remains descriptive"); }',
				"errors.py":
					'def fail():\n    raise RuntimeError("this is a deliberately long failure message that exceeds the normal callable character allowance for the test and remains descriptive")',
				"ordinary.ts":
					'function value(): string { return "this is a deliberately long return value that exceeds the normal callable character allowance for the test and remains descriptive"; }',
				"ordinary.py":
					'def value():\n    return "this is a deliberately long return value that exceeds the normal callable character allowance for the test and remains descriptive"',
			},
			(production_lint_configuration, options, mode) =>
				production_lint_configuration.lint_report(options, mode).report.violations,
		);

		const short_function_messages = violations
			.filter((item) => item.rule_id === "callable-min-size")
			.map((item) => item.message);
		expect(short_function_messages).toHaveLength(2);
		expect(short_function_messages).toEqual(["function is too short", "function is too short"]);
	});

	test("applies per-test method limits but no aggregate class-method limit to Python tests", () => {
		const test_fixture = new TestFixture();
		const source_lines = [
			"import unittest",
			"class TestService(unittest.TestCase):",
			"    def test_large(self):",
			...Array.from({ length: 20 }, (_, index) => `        value_${index} = ${index}`),
			...Array.from({ length: 20 }, (_, index) => `    def test_case_${index}(self):\n        return ${index}`),
			"    def test_case_last(self):",
			"        return 21",
		];
		const source = source_lines.join("\n");
		const violations = test_fixture.with_lint_request(
			new LintRunConfiguration(new SourceText(), new NodeFileIO()),
			{
				"tests/test_limits_test.py": source,
			},
			(production_lint_configuration, options, mode) =>
				production_lint_configuration.lint_report(options, mode).report.violations,
		);
		const messages = violations.map((item) => item.message);

		expect(violations.some((item) => item.rule_id === "test-max-size")).toBe(true);
		expect(messages).not.toContain("class has too many methods (found 22)");
	});

	test("allows multiple exception classes in one file", () => {
		const test_fixture = new TestFixture();

		const violations = test_fixture.with_lint_request(
			new LintRunConfiguration(new SourceText(), new NodeFileIO()),
			{
				"errors.ts": ["export class FirstError extends Error {}", "export class SecondError extends Error {}"].join(
					"\n",
				),
				"errors.py": ["class FirstError(Exception):", "    pass", "class SecondError(ValueError):", "    pass"].join(
					"\n",
				),
			},
			(production_lint_configuration, options, mode) =>
				production_lint_configuration.lint_report(options, mode).report.violations,
		);

		expect(violations).not.toEqual(
			expect.arrayContaining([
				expect.objectContaining({
					message: "file contains too many top-level classes",
				}),
			]),
		);
	});

	test("groups class-like prefixes in nested TypeScript functions", () => {
		const test_fixture = new TestFixture();
		const violations = test_fixture.with_lint_request(
			new LintRunConfiguration(new SourceText(), new NodeFileIO()),
			{
				"nested-prefix.ts": [
					"function candidate(): void {",
					'  function _Widget_create(): string { return ""; }',
					'  function _Widget_reset(): string { return ""; }',
					"  _Widget_create();",
					"}",
				].join("\n"),
			},
			(production_lint_configuration, options, mode) =>
				production_lint_configuration.lint_report(options, mode).report.violations,
		);

		expect(violations.filter((item) => item.rule_id === "class-like-prefix")).toHaveLength(1);
	});

	test("allows short classes when a short file contains multiple classes", () => {
		const test_fixture = new TestFixture();

		const violations = test_fixture.with_lint_request(
			new LintRunConfiguration(new SourceText(), new NodeFileIO()),
			SHORT_CLASS_FILES,
			(production_lint_configuration, options, mode) =>
				production_lint_configuration.lint_report(options, mode).report.violations,
		);

		expect(
			violations.some(
				(violation) =>
					(violation.file === "small-classes.ts" || violation.file === "small-classes.py") &&
					violation.message.includes("(min 15)"),
			),
		).toBe(false);
	});
});
