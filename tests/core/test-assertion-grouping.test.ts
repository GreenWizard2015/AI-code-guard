import { describe, expect, test } from "@jest/globals";
import { LintRunConfiguration } from "src/core/lint_run_configuration";
import { SourceText } from "src/source_text";
import { NodeFileIO } from "src/io/node_file_io";
import { COMPLEX_ASSERTION_FILES } from "tests/bridge/ts/core/constants";
import { TestFixture } from "tests/core/test-fixture";

describe("assertion grouping in project tests", () => {
	test("groups related Jest expectations and suggests splitting oversized Jest tests", () => {
		const fixture = new TestFixture();
		const violations = fixture.with_lint_request(
			new LintRunConfiguration(new SourceText(), new NodeFileIO()),
			{
				"tests/result.test.ts": [
					"describe('result', () => {",
					"  test('many fields', () => {",
					"    const check = expect;",
					'    check(result.name).toBe("Service");',
					'    check(result.base).toEqual(["Record"]);',
					'    check(result.visibility).toBe("private");',
					"  });",
					"  test('one field', () => {",
					'    expect(result.name).toBe("Service");',
					"  });",
					"});",
				].join("\n"),
				...Object.fromEntries(Object.entries(COMPLEX_ASSERTION_FILES).filter(([file]) => file.endsWith(".ts"))),
			},
			(production_lint_configuration, options, mode) =>
				production_lint_configuration.lint_report(options, mode).report.violations,
		);
		expect(violations.filter((item) => item.rule_id === "test-assertion-grouping")).toHaveLength(2);
		expect(violations.filter((item) => item.rule_id === "test-too-many-assertions")).toHaveLength(1);
	});

	test("groups related unittest assertions and identifies unsafe assertion aliases", () => {
		const fixture = new TestFixture();
		const violations = fixture.with_lint_request(
			new LintRunConfiguration(new SourceText(), new NodeFileIO()),
			{
				"tests/result_test.py": [
					"import unittest",
					"class TestResult(unittest.TestCase):",
					"    def test_fields(self):",
					'        self.assertEqual(result["name"], "Service")',
					'        self.assertEqual(result["base"], ["Record"])',
					'        self.assertEqual(result["visibility"], "private")',
					"    def test_aliased_fields(self):",
					"        check_true, *ignored = (self.assertTrue, None, None)",
					"        check_equal, *ignored = (self.assertEqual, None, None)",
					"        check_true(True)",
					"        check_equal(1, 1)",
					"        self.assertIsNotNone(object())",
					"    def test_one_field(self):",
					'        self.assertEqual(result["name"], "Service")',
				].join("\n"),
				"tests/indexed_assertion_test.py": [
					"import unittest",
					"class TestResult(unittest.TestCase):",
					"    def test_fields(self):",
					"        checks = (self.assertTrue, self.assertEqual)",
					"        checks[0](True)",
					"        checks[1](1, 1)",
					"        self.assertIsNotNone(object())",
				].join("\n"),
				"tests/destructured_assertion_test.py": [
					"import unittest",
					"class TestResult(unittest.TestCase):",
					"    def test_fields(self):",
					'        checks = {"equal": self.assertEqual}',
					'        check, ignored = (checks["equal"], None)',
					"        check(1, 1)",
					"        self.assertIsNotNone(object())",
				].join("\n"),
				"tests/dynamic_assertion_key_test.py": [
					"import unittest",
					"class TestResult(unittest.TestCase):",
					"    def test_fields(self):",
					'        checks = {"assert_true": self.assertTrue}',
					'        method_name = "assert_true"',
					"        checks[method_name](True)",
					"        self.assertIsNotNone(object())",
				].join("\n"),
				...Object.fromEntries(Object.entries(COMPLEX_ASSERTION_FILES).filter(([file]) => file.endsWith(".py"))),
			},
			(production_lint_configuration, options, mode) =>
				production_lint_configuration.lint_report(options, mode).report.violations,
		);
		expect({
			grouping: violations.filter((item) => item.rule_id === "test-assertion-grouping").length,
			unsafe_aliases: violations.filter((item) => item.rule_id === "python-test-assertion-alias").length,
			complexity: violations.filter((item) => item.rule_id === "test-too-many-assertions").length,
		}).toEqual({ grouping: 4, unsafe_aliases: 4, complexity: 1 });
	});
});
