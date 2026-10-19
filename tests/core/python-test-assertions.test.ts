import { describe, expect, test } from "@jest/globals";
import { LintRunConfiguration } from "src/core/lint_run_configuration";
import { SourceText } from "src/source_text";
import { NodeFileIO } from "src/io/node_file_io";
import { TestFixture } from "tests/core/test-fixture";

describe("coding-lint Python unittest assertions", () => {
	test("applies shared test-method count limits to unittest suites", () => {
		const fixture = new TestFixture();
		const oversized_methods = Array.from(
			{ length: 16 },
			(_, index) => `    def test_case_${index}(self):\n        self.assertEqual(${index}, ${index})`,
		);
		const source_lines = [
			"import unittest",
			"class TestSmallSuite(unittest.TestCase):",
			"    def test_single_case(self):",
			"        self.assertEqual(1, 1)",
			"class TestLargeSuite(unittest.TestCase):",
		];
		source_lines.push(...oversized_methods);
		const violations = fixture.with_lint_request(
			new LintRunConfiguration(new SourceText(), new NodeFileIO()),
			{
				"tests/test_count.py": source_lines.join("\n"),
			},
			(production_lint_configuration, options, mode) =>
				production_lint_configuration.lint_report(options, mode).report.violations,
		);
		expect({
			minimum: violations.filter((item) => item.rule_id === "test-min-count").length,
			maximum: violations.filter((item) => item.rule_id === "test-max-count").length,
		}).toEqual({ minimum: 1, maximum: 1 });
	});

	test("requires self.assert* assertions for unittest test methods", () => {
		const fixture = new TestFixture();
		const violations = fixture.with_lint_request(
			new LintRunConfiguration(new SourceText(), new NodeFileIO()),
			{
				"tests/unittest_test.py": [
					"import unittest",
					"",
					"class TestService(unittest.TestCase):",
					"    def test_without_assertion(self):",
					"        value = 1",
					"",
					"    def test_with_assertion(self):",
					"        self.assertEqual(1, 1)",
					"        self.assertTrue(True)",
				].join("\n"),
			},
			(production_lint_configuration, options, mode) =>
				production_lint_configuration.lint_report(options, mode).report.violations,
		);
		const assertion_violations = violations.filter(
			(violation) => violation.message === "Python unittest test must contain a direct self.assert* assertion",
		);
		expect({ count: assertion_violations.length, line: assertion_violations[0]?.line }).toEqual({ count: 1, line: 4 });
	});

	test("recognizes reflected unittest assertions", () => {
		const fixture = new TestFixture();
		const violations = fixture.with_lint_request(
			new LintRunConfiguration(new SourceText(), new NodeFileIO()),
			{
				"tests/unittest_test.py": [
					"import unittest",
					"class TestService(unittest.TestCase):",
					"    def test_value(self):",
					'        getattr(self, "assertTrue")(True)',
				].join("\n"),
			},
			(production_lint_configuration, options, mode) =>
				production_lint_configuration.lint_report(options, mode).report.violations,
		);
		expect(violations.filter((item) => item.rule_id === "python-test-assert")).toHaveLength(0);
	});

	test("rejects unittest tests that only check exceptions", () => {
		const fixture = new TestFixture();
		const violations = fixture.with_lint_request(
			new LintRunConfiguration(new SourceText(), new NodeFileIO()),
			{
				"tests/exception_test.py": [
					"import unittest",
					"",
					"class TestService(unittest.TestCase):",
					"    def test_only_exception(self):",
					"        self.assertRaises(ValueError, load_service)",
					"",
					"    def test_checks_result(self):",
					"        result = load_service()",
					"        self.assertEqual(result, expected_service)",
					"",
					"    def test_alias_exception(self):",
					"        check = self.assertRaises",
					"        check(ValueError, load_service)",
				].join("\n"),
			},
			(production_lint_configuration, options, mode) =>
				production_lint_configuration.lint_report(options, mode).report.violations,
		);
		expect(violations.filter((item) => item.rule_id === "test-exception-only")).toHaveLength(2);
	});

	test("rejects Python exception-only bypass patterns", () => {
		const fixture = new TestFixture();
		const violations = fixture.with_lint_request(
			new LintRunConfiguration(new SourceText(), new NodeFileIO()),
			{
				"tests/bypass_test.py": [
					"class TestService:",
					"    def test_manual_catch(self):",
					"        try:",
					"            load_service()",
					"        except ValueError:",
					"            pass",
					"",
					"    def test_error_type(self):",
					"        try:",
					"            load_service()",
					"        except Exception as error:",
					"            assert isinstance(error, ValueError)",
					"",
					"    def test_raised_flag(self):",
					"        raised = False",
					"        try:",
					"            load_service()",
					"        except ValueError:",
					"            raised = True",
					"        assert raised",
				].join("\n"),
			},
			(production_lint_configuration, options, mode) =>
				production_lint_configuration.lint_report(options, mode).report.violations,
		);
		expect(violations.filter((item) => item.rule_id === "test-exception-only")).toHaveLength(3);
	});

	test("requires assertions at test level in a final consecutive block", () => {
		const fixture = new TestFixture();
		const violations = fixture.with_lint_request(
			new LintRunConfiguration(new SourceText(), new NodeFileIO()),
			{
				"tests/unittest_test.py": [
					"import unittest",
					"",
					"class TestService(unittest.TestCase):",
					"    def test_nested_assertion(self):",
					"        if True:",
					"            self.assertEqual(1, 1)",
					"        self.assertEqual(1, 1)",
					"",
					"    def test_not_at_end(self):",
					"        self.assertEqual(1, 1)",
					"        value = 1",
				].join("\n"),
			},
			(production_lint_configuration, options, mode) =>
				production_lint_configuration.lint_report(options, mode).report.violations,
		);
		expect({
			missing_direct_assertion: violations.filter((item) => item.rule_id === "python-test-assert").length,
			ending: violations.filter((item) => item.rule_id === "python-test-assert-ending").length,
		}).toEqual({ missing_direct_assertion: 0, ending: 2 });
	});

	test("rejects assertions hidden in a Python helper lambda", () => {
		const fixture = new TestFixture();
		const violations = fixture.with_lint_request(
			new LintRunConfiguration(new SourceText(), new NodeFileIO()),
			{
				"tests/unittest_test.py":
					"import unittest\n\nclass TestService(unittest.TestCase):\n    def test_helper(self):\n        check = lambda: self.assertEqual(1, 1)\n        check()\n",
			},
			(production_lint_configuration, options, mode) =>
				production_lint_configuration.lint_report(options, mode).report.violations,
		);
		expect(violations.filter((item) => item.rule_id === "python-test-assert")).toHaveLength(1);
	});

	test("limits assertion count only on actual unittest test methods", () => {
		const fixture = new TestFixture();
		const source_lines = [
			"import unittest",
			"class TestService(unittest.TestCase):",
			"    def helper_with_many_assertions(self):",
			...Array.from({ length: 6 }, (_, index) => `        self.assertEqual(${index}, ${index})`),
			"    def test_with_many_assertions(self):",
			...Array.from({ length: 6 }, (_, index) => `        self.assertEqual(${index}, ${index})`),
			"    @fixture",
			"    def test_fixture_with_many_assertions(self):",
			...Array.from({ length: 6 }, (_, index) => `        self.assertEqual(${index}, ${index})`),
		];
		const source = source_lines.join("\n");
		const violations = fixture.with_lint_request(
			new LintRunConfiguration(new SourceText(), new NodeFileIO()),
			{ "tests/test_assertion_scope.py": source },
			(production_lint_configuration, options, mode) =>
				production_lint_configuration.lint_report(options, mode).report.violations,
		);

		expect(violations.filter((item) => item.rule_id === "test-too-many-assertions").map((item) => item.line)).toEqual([
			10,
		]);
	});

	test("requires Python properties to use explicit methods", () => {
		const fixture = new TestFixture();
		const violations = fixture.with_lint_request(
			new LintRunConfiguration(new SourceText(), new NodeFileIO()),
			{
				"service.py": [
					"class Service:",
					"    @property",
					"    def status(self):",
					"        return self.load_status()",
					"",
					"    @cached_property",
					"    def cached_status(self):",
					"        return self.load_status()",
				].join("\n"),
			},
			(production_lint_configuration, options, mode) =>
				production_lint_configuration.lint_report(options, mode).report.violations,
		);
		expect(violations.filter((item) => item.rule_id === "python-property")).toHaveLength(1);
	});

	test("rejects aliased Python property setters", () => {
		const fixture = new TestFixture();
		const violations = fixture.with_lint_request(
			new LintRunConfiguration(new SourceText(), new NodeFileIO()),
			{
				"service.py": [
					"class Profile:",
					"    @property",
					"    def name(self):",
					"        return self._name",
					"",
					"setter = Profile.name.setter",
					"",
					"class ExtendedProfile(Profile):",
					"    @setter",
					"    def name(self, value):",
					"        self._name = value",
				].join("\n"),
			},
			(production_lint_configuration, options, mode) =>
				production_lint_configuration.lint_report(options, mode).report.violations,
		);
		expect(violations.filter((item) => item.rule_id === "python-property-setter")).toHaveLength(1);
	});

	test("applies shared min and max size rules to individual Python tests", () => {
		const fixture = new TestFixture();
		const source_lines = [
			"import unittest",
			"",
			"class TestService(unittest.TestCase):",
			"    def test_short(self):",
			"        self.assertEqual(1, 1)",
			"",
			"    def test_meaningful(self):",
			"        result = 1 + 1",
			"        self.assertEqual(result, 2)",
			"",
			"    def test_maximum_boundary(self):",
			...Array.from({ length: 13 }, (_, index) => `        boundary_${index} = ${index}`),
			"        self.assertEqual(boundary_12, 12)",
			"",
			"    def test_long(self):",
			...Array.from({ length: 16 }, (_, index) => `        value_${index} = ${index}`),
			"        self.assertEqual(value_15, 15)",
			"",
			"def test_free_function():",
			...Array.from({ length: 16 }, (_, index) => `    free_value_${index} = ${index}`),
			"    pass",
			"",
			"class PlainTests:",
			"    def test_non_unittest_method(self):",
			...Array.from({ length: 16 }, (_, index) => `        plain_value_${index} = ${index}`),
			"        pass",
		];
		const source = source_lines.join("\n");
		const violations = fixture.with_lint_request(
			new LintRunConfiguration(new SourceText(), new NodeFileIO()),
			{ "tests/test_size.py": source },
			(production_lint_configuration, options, mode) =>
				production_lint_configuration.lint_report(options, mode).report.violations,
		);

		expect(violations.filter((item) => item.rule_id === "test-min-size").map((item) => item.line)).toEqual([4]);
		expect(violations.filter((item) => item.rule_id === "test-max-size").map((item) => item.line)).toEqual([27]);
	});

	test("does not apply aggregate class-size rules to Python test classes", () => {
		const fixture = new TestFixture();
		const source_lines = [
			"import unittest",
			"class TestLarge(unittest.TestCase):",
			"    def test_large(self):",
			...Array.from({ length: 160 }, (_, index) => `        value_${index} = ${index}`),
			"        self.assertEqual(value_159, 159)",
		];
		const source = source_lines.join("\n");
		const violations = fixture.with_lint_request(
			new LintRunConfiguration(new SourceText(), new NodeFileIO()),
			{ "tests/test_large.py": source },
			(production_lint_configuration, options, mode) =>
				production_lint_configuration.lint_report(options, mode).report.violations,
		);

		expect(
			violations.filter((item) => ["class-min-size", "class-max-size", "class-size"].includes(item.rule_id)),
		).toEqual([]);
		expect(violations.filter((item) => item.rule_id === "test-max-size")).toHaveLength(1);
	});
});
