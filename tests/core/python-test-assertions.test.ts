import { describe, expect, test } from "@jest/globals";
import { LintRunConfiguration } from "src/core/lint_run_configuration";
import { NodeFileIO } from "src/io/node_file_io";
import { SourceText } from "src/io/source_text";
import { TestFixture } from "tests/core/test-fixture";

describe("coding-lint Python unittest assertions", () => {
	test("applies test-count rules to unittest cases", () => {
		const fixture = new TestFixture();
		const oversized_methods = Array.from(
			{ length: 16 },
			(_, index) => `    def test_case_${index}(self):\n        self.assertEqual(${index}, ${index})`,
		);
		const count_lines = [
			"import unittest",
			"class TestSmallSuite(unittest.TestCase):",
			"    def test_single_case(self):",
			"        self.assertEqual(1, 1)",
			"class TestLargeSuite(unittest.TestCase):",
			...oversized_methods,
		];
		const count_source = count_lines.join("\n");
		const violations = fixture.with_lint_request(
			new LintRunConfiguration(new SourceText(), new NodeFileIO(process.cwd())),
			{ "tests/test_count.py": count_source },
			(production_lint_configuration, options, mode) =>
				production_lint_configuration.lint_report(options, mode).report.violations,
		);
		const count_findings = violations.filter((item) => ["test-min-count", "test-max-count"].includes(item.rule_id()));
		const count_locations = count_findings.map((item) => `${item.file()}:${item.rule_id()}`).sort();

		expect(count_locations).toEqual(["tests/test_count.py:test-max-count", "tests/test_count.py:test-min-count"]);
	});

	test("reports unittest methods outside their size bounds", () => {
		const fixture = new TestFixture();
		const boundary_assignments = Array.from({ length: 13 }, (_, index) => `        boundary_${index} = ${index}`);
		const long_method_assignments = Array.from({ length: 16 }, (_, index) => `        value_${index} = ${index}`);
		const size_lines = [
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
			...boundary_assignments,
			"        self.assertEqual(boundary_12, 12)",
			"",
			"    def test_long(self):",
			...long_method_assignments,
			"        self.assertEqual(value_15, 15)",
			"",
		];
		const size_source = size_lines.join("\n");
		const violations = fixture.with_lint_request(
			new LintRunConfiguration(new SourceText(), new NodeFileIO(process.cwd())),
			{ "tests/test_size.py": size_source },
			(production_lint_configuration, options, mode) =>
				production_lint_configuration.lint_report(options, mode).report.violations,
		);

		const size_findings = violations.filter((item) => ["test-min-size", "test-max-size"].includes(item.rule_id()));
		const size_locations = size_findings.map((item) => `${item.file()}:${item.rule_id()}:${item.line()}`).sort();
		const class_size_locations = violations
			.filter((item) => ["class-min-size", "class-max-size", "class-size"].includes(item.rule_id()))
			.map((item) => `${item.file()}:${item.line()}`);

		expect({ size_locations, class_size_locations }).toEqual({
			size_locations: ["tests/test_size.py:test-max-size:27", "tests/test_size.py:test-min-size:4"],
			class_size_locations: [],
		});
	});

	test("ignores long functions and methods outside unittest cases", () => {
		const fixture = new TestFixture();
		const assignments = Array.from({ length: 16 }, (_, index) => `    value_${index} = ${index}`);
		const lines = [
			"def test_free_function():",
			...assignments,
			"    pass",
			"",
			"class PlainTests:",
			"    def test_non_unittest_method(self):",
			...assignments.map((line) => `    ${line}`),
			"        pass",
		];
		const source = lines.join("\n");
		const violations = fixture.with_lint_request(
			new LintRunConfiguration(new SourceText(), new NodeFileIO(process.cwd())),
			{ "tests/non_unittest.py": source },
			(production_lint_configuration, options, mode) =>
				production_lint_configuration.lint_report(options, mode).report.violations,
		);
		const test_size_violations = violations.filter((item) =>
			["test-min-size", "test-max-size"].includes(item.rule_id()),
		);

		expect(test_size_violations).toEqual([]);
	});

	test("rejects an exceptionally large unittest method", () => {
		const fixture = new TestFixture();
		const assignments = Array.from({ length: 160 }, (_, index) => `        value_${index} = ${index}`);
		const lines = [
			"import unittest",
			"class TestLarge(unittest.TestCase):",
			"    def test_large(self):",
			...assignments,
			"        self.assertEqual(value_159, 159)",
		];
		const source = lines.join("\n");
		const violations = fixture.with_lint_request(
			new LintRunConfiguration(new SourceText(), new NodeFileIO(process.cwd())),
			{ "tests/test_large.py": source },
			(production_lint_configuration, options, mode) =>
				production_lint_configuration.lint_report(options, mode).report.violations,
		);
		const excessive_method_locations = violations
			.filter((item) => item.rule_id() === "test-max-size")
			.map((item) => `${item.file()}:${item.line()}`);

		expect(excessive_method_locations).toEqual(["tests/test_large.py:3"]);
	});

	test("checks direct, reflected, and test-level assertion behavior", () => {
		const fixture = new TestFixture();
		const helper_assertions = Array.from({ length: 6 }, (_, index) => `        self.assertEqual(${index}, ${index})`);
		const test_assertions = Array.from({ length: 6 }, (_, index) => `        self.assertEqual(${index}, ${index})`);
		const fixture_assertions = Array.from({ length: 6 }, (_, index) => `        self.assertEqual(${index}, ${index})`);
		const assertion_scope_lines = [
			"import unittest",
			"class TestService(unittest.TestCase):",
			"    def helper_with_many_assertions(self):",
			...helper_assertions,
			"    def test_with_many_assertions(self):",
			...test_assertions,
			"    @fixture",
			"    def test_fixture_with_many_assertions(self):",
			...fixture_assertions,
		];
		const assertion_scope_source = assertion_scope_lines.join("\n");
		const violations = fixture.with_lint_request(
			new LintRunConfiguration(new SourceText(), new NodeFileIO(process.cwd())),
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
					"",
					"    def test_reflected(self):",
					'        getattr(self, "assertTrue")(True)',
					"",
					"    def test_nested_assertion(self):",
					"        if True:",
					"            self.assertEqual(1, 1)",
					"        self.assertEqual(1, 1)",
					"",
					"    def test_not_at_end(self):",
					"        self.assertEqual(1, 1)",
					"        value = 1",
					"",
					"    def test_helper(self):",
					"        check = lambda: self.assertEqual(1, 1)",
					"        check()",
				].join("\n"),
				"tests/assertion_scope.py": assertion_scope_source,
			},
			(production_lint_configuration, options, mode) =>
				production_lint_configuration.lint_report(options, mode).report.violations,
		);

		const missing_assertions = violations.filter(
			(item) => item.message() === "Python unittest test must contain a direct self.assert* assertion",
		);
		const missing_assertion_locations = missing_assertions.map((item) => `${item.file()}:${item.line()}`).sort();
		const assertion_ending_locations = violations
			.filter((item) => item.rule_id() === "python-test-assert-ending")
			.map((item) => `${item.file()}:${item.line()}`)
			.sort();
		const too_many_assertion_locations = violations
			.filter((item) => item.rule_id() === "test-too-many-assertions")
			.map((item) => `${item.file()}:${item.line()}`)
			.sort();

		expect({ missing_assertion_locations, assertion_ending_locations, too_many_assertion_locations }).toEqual({
			missing_assertion_locations: ["tests/unittest_test.py:23", "tests/unittest_test.py:4"],
			assertion_ending_locations: ["tests/unittest_test.py:14", "tests/unittest_test.py:19"],
			too_many_assertion_locations: ["tests/assertion_scope.py:10"],
		});
	});

	test("rejects exception-only assertions and exception-handling bypasses", () => {
		const fixture = new TestFixture();
		const violations = fixture.with_lint_request(
			new LintRunConfiguration(new SourceText(), new NodeFileIO(process.cwd())),
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

		const exception_only = violations.filter((item) => item.rule_id() === "test-exception-only");
		expect({
			unittest: exception_only.filter((item) => item.file().endsWith("exception_test.py")).length,
			bypass: exception_only.filter((item) => item.file().endsWith("bypass_test.py")).length,
			lines: exception_only.filter((item) => item.file().endsWith("bypass_test.py")).map((item) => item.line()),
		}).toEqual({ unittest: 2, bypass: 3, lines: [2, 8, 14] });
	});

	test("requires explicit Python property accessors", () => {
		const fixture = new TestFixture();
		const violations = fixture.with_lint_request(
			new LintRunConfiguration(new SourceText(), new NodeFileIO(process.cwd())),
			{
				"properties.py": [
					"class Service:",
					"    @property",
					"    def status(self):",
					"        return self.load_status()",
					"",
					"    @cached_property",
					"    def cached_status(self):",
					"        return self.load_status()",
				].join("\n"),
				"property-setter.py": [
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

		const properties = violations.filter((item) => item.rule_id() === "python-property");
		expect({
			standalone: properties.filter((item) => item.file().endsWith("properties.py")).length,
			setter_owner: properties.filter((item) => item.file().endsWith("property-setter.py")).length,
		}).toEqual({ standalone: 1, setter_owner: 1 });
		expect(
			violations
				.filter((item) => item.rule_id() === "python-property-setter")
				.map((item) => item.file().endsWith("property-setter.py")),
		).toEqual([true]);
	});
});
