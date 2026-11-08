import { describe, expect, test } from "@jest/globals";
import { LintRunConfiguration } from "src/core/lint_run_configuration";
import { NodeFileIO } from "src/io/node_file_io";
import { SourceText } from "src/io/source_text";
import { TestFixture } from "tests/core/test-fixture";

describe("Python test framework and structure", () => {
	test("uses unittest consistently and resolves imported base aliases", () => {
		const fixture = new TestFixture();
		const violations = fixture.with_lint_request(
			new LintRunConfiguration(new SourceText(), new NodeFileIO(process.cwd())),
			{
				"tests/test_pytest_one.py": "def test_one():\n    return True\n",
				"tests/test_pytest_two.py": "def test_two():\n    return True\n",
				"tests/test_unittest.py": [
					"import unittest",
					"class TestValue(unittest.TestCase):",
					"    def test_value(self):",
					"        self.assertTrue(True)",
				].join("\n"),
				"tests/test_alias_from.py": [
					"from unittest import TestCase as ImportedTestCase",
					"class TestImported(ImportedTestCase):",
					"    def test_value(self):",
					"        self.assertTrue(True)",
				].join("\n"),
				"tests/test_alias_module.py": [
					"import unittest as unit",
					"class TestImported(unit.TestCase):",
					"    def test_value(self):",
					"        self.assertTrue(True)",
				].join("\n"),
			},
			(production_lint_configuration, options, mode) =>
				production_lint_configuration.lint_report(options, mode).report.violations,
		);
		const consistency_violations = violations.filter((item) => item.rule_id() === "python-test-framework-consistency");
		expect(consistency_violations.map((item) => item.file())).toEqual([
			"tests/test_pytest_one.py",
			"tests/test_pytest_two.py",
		]);
		expect(violations.filter((item) => item.rule_id() === "python-test-class-inheritance")).toHaveLength(0);
	});

	test("requires each Python test class to inherit only from unittest.TestCase", () => {
		const fixture = new TestFixture();
		const violations = fixture.with_lint_request(
			new LintRunConfiguration(new SourceText(), new NodeFileIO(process.cwd())),
			{
				"tests/test_plain_class.py": ["class TestPlain:", "    def test_value(self):", "        return True"].join(
					"\n",
				),
				"tests/test_local_base.py": [
					"class Helper:",
					"    pass",
					"class TestLocal(Helper):",
					"    def test_value(self):",
					"        return True",
				].join("\n"),
				"tests/test_wrong_base.py": [
					"import unittest",
					"class TestWrong:",
					"    def test_value(self):",
					"        return True",
				].join("\n"),
				"tests/test_multiple_bases.py": [
					"import unittest",
					"class Helper:",
					"    pass",
					"class TestMultiple(unittest.TestCase, Helper):",
					"    def test_value(self):",
					"        self.assertTrue(True)",
				].join("\n"),
				"tests/test_dot_test.test.py": ["class TestDotFile:", "    def test_value(self):", "        return True"].join(
					"\n",
				),
			},
			(production_lint_configuration, options, mode) =>
				production_lint_configuration.lint_report(options, mode).report.violations,
		);
		const inheritance_violations = violations.filter((item) => item.rule_id() === "python-test-class-inheritance");
		expect(inheritance_violations.map((item) => item.file())).toEqual([
			"tests/test_dot_test.test.py",
			"tests/test_local_base.py",
			"tests/test_multiple_bases.py",
			"tests/test_plain_class.py",
			"tests/test_wrong_base.py",
		]);
	});

	test("rejects direct, aliased, and reflected self.subTest usage", () => {
		const fixture = new TestFixture();
		const violations = fixture.with_lint_request(
			new LintRunConfiguration(new SourceText(), new NodeFileIO(process.cwd())),
			{
				"tests/test_subtests.py": [
					"import unittest",
					"class TestValues(unittest.TestCase):",
					"    def test_direct(self):",
					"        with self.subTest(value=1):",
					"            self.assertEqual(1, 1)",
					"        self.assertTrue(True)",
					"    def test_aliased(self):",
					"        check = self.subTest",
					"        with check(value=2):",
					"            self.assertEqual(2, 2)",
					"        self.assertTrue(True)",
					"    def test_reflected(self):",
					'        with getattr(self, "subTest")(value=3):',
					"            self.assertEqual(3, 3)",
					"        self.assertTrue(True)",
				].join("\n"),
			},
			(production_lint_configuration, options, mode) =>
				production_lint_configuration.lint_report(options, mode).report.violations,
		);
		const subtest_violations = violations.filter((item) => item.rule_id() === "python-test-subtest");
		expect({
			count: subtest_violations.length,
			lines: subtest_violations.map((item) => item.line()),
			parameterized_hint: subtest_violations.every((item) => item.hint().includes("parameterized.expand")),
		}).toEqual({ count: 3, lines: [4, 9, 13], parameterized_hint: true });
	});

	test("counts parameterized.expand rows as unittest test cases", () => {
		const fixture = new TestFixture();
		const rows = Array.from({ length: 16 }, (_, index) => `        (${index},),`).join("\n");
		const small_rows = ["        (1,),", "        (2,),"];
		const minimum_suite_lines = [
			"import unittest",
			"from parameterized import parameterized",
			"class TestValues(unittest.TestCase):",
			"    @parameterized.expand([",
			...small_rows,
			"    ])",
			"    def test_value(self, value):",
			"        self.assertEqual(value, value)",
		];
		const minimum_suite = minimum_suite_lines.join("\n");
		const violations = fixture.with_lint_request(
			new LintRunConfiguration(new SourceText(), new NodeFileIO(process.cwd())),
			{
				"tests/test_parameterized.py": [
					"import unittest",
					"from parameterized import parameterized",
					"class TestValues(unittest.TestCase):",
					"    @parameterized.expand([",
					rows,
					"    ])",
					"    def test_value(self, value):",
					"        self.assertEqual(value, value)",
				].join("\n"),
				"tests/test_parameterized_minimum.py": minimum_suite,
			},
			(production_lint_configuration, options, mode) =>
				production_lint_configuration.lint_report(options, mode).report.violations,
		);
		const count_violation = violations.find((item) => item.rule_id() === "test-max-count");
		let maximum_message = "";
		if (count_violation !== undefined) {
			maximum_message = count_violation.message();
		}

		expect({
			maximum: maximum_message,
			small_suite_minimum: violations.some(
				(item) => item.rule_id() === "test-min-count" && item.file() === "tests/test_parameterized_minimum.py",
			),
		}).toEqual({ maximum: expect.stringContaining("found 16"), small_suite_minimum: false });
	});
});
