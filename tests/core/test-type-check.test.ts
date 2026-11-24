import { describe, expect, test } from "@jest/globals";
import { LintRunConfiguration } from "src/core/lint_run_configuration";
import { NodeFileIO } from "src/io/node_file_io";
import { SourceText } from "src/io/source_text";
import { TestFixture } from "tests/core/test-fixture";

describe("test-type-check", () => {
	test("reports runtime type probes in Python and TypeScript tests even beside behavior assertions", () => {
		const fixture = new TestFixture();
		const violations = fixture.with_lint_request(
			new LintRunConfiguration(new SourceText(), new NodeFileIO(process.cwd())),
			{
				"tests/service.test.ts": [
					'describe("service", () => {',
					'test("checks its result", () => {',
					"  const result = service.run();",
					"  expect(result.value).toBe(3);",
					"  expect(result).toBeInstanceOf(Success);",
					'  if (typeof result === "object") { expect(result.value).toBe(3); }',
					"  expect({ result }).toEqual({ result: expect.any(Success) });",
					"});",
					'test("checks an array", () => {',
					"  expect(Array.isArray(service.items())).toBe(true);",
					"  expect(service.items()).toEqual([]);",
					"});",
					"});",
				].join("\n"),
				"tests/service_test.py": [
					"import unittest",
					"",
					"class ServiceTests(unittest.TestCase):",
					"    def test_result(self) -> None:",
					"        result = Service().run()",
					"        self.assertEqual(result.value, 3)",
					"        self.assertIsInstance(result, Success)",
					"        self.assertTrue(isinstance(result, Success))",
				].join("\n"),
			},
			(production_lint_configuration, options, mode) =>
				production_lint_configuration.lint_report(options, mode).report.violations,
		);

		expect(
			violations.filter((item) => item.rule_id() === "test-type-check").map((item) => [item.file(), item.line()]),
		).toEqual([
			["tests/service.test.ts", 5],
			["tests/service.test.ts", 6],
			["tests/service.test.ts", 7],
			["tests/service.test.ts", 10],
			["tests/service_test.py", 7],
			["tests/service_test.py", 8],
		]);
	});
	test("reports Python type inspection and class-pattern matching", () => {
		const fixture = new TestFixture();
		const violations = fixture.with_lint_request(
			new LintRunConfiguration(new SourceText(), new NodeFileIO(process.cwd())),
			{
				"tests/result_test.py": [
					"import unittest",
					"class ResultTests(unittest.TestCase):",
					"    def test_success(self) -> None:",
					"        result = Service().run()",
					"        if type(result) is Success:",
					"            self.assertEqual(result.value, 3)",
					"        match result:",
					"            case Success():",
					"                self.assertEqual(result.value, 3)",
				].join("\n"),
			},
			(production_lint_configuration, options, mode) =>
				production_lint_configuration.lint_report(options, mode).report.violations,
		);

		expect(violations.filter((item) => item.rule_id() === "test-type-check").map((item) => item.line())).toEqual([
			5, 8,
		]);
	});

	test("checks test setup helpers but ignores annotations and similarly named production helpers", () => {
		const fixture = new TestFixture();
		const violations = fixture.with_lint_request(
			new LintRunConfiguration(new SourceText(), new NodeFileIO(process.cwd())),
			{
				"src/support/helpers.py": ["def test_callable_name(value):", "    return isinstance(value, Callable)"].join(
					"\n",
				),
				"tests/result.test.ts": [
					"const success = { value: 3 };",
					"type SuccessValue = typeof success;",
					'test("checks the returned value", () => {',
					"  const result: SuccessValue = service.run();",
					"  expect(result.value).toBe(3);",
					"});",
				].join("\n"),
				"tests/result_test.py": [
					"import unittest",
					"class ResultTests(unittest.TestCase):",
					"    def test_value(self) -> None:",
					"        result: Success = Service().run()",
					"        self.assertEqual(result.value, 3)",
				].join("\n"),
				"tests/service_helper_test.py": [
					"import unittest",
					"class ServiceTests(unittest.TestCase):",
					"    def setUp(self):",
					"        self.value = Service().run()",
					"        isinstance(self.value, Success)",
					"    def value_type(self):",
					"        return type(self.value)",
					"    def test_value(self):",
					"        self.assertEqual(self.value.value, 3)",
				].join("\n"),
			},
			(production_lint_configuration, options, mode) =>
				production_lint_configuration.lint_report(options, mode).report.violations,
		);

		expect(
			violations.filter((item) => item.rule_id() === "test-type-check").map((item) => [item.file(), item.line()]),
		).toEqual([
			["tests/service_helper_test.py", 5],
			["tests/service_helper_test.py", 7],
		]);
	});
});
