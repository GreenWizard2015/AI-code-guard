import { describe, expect, test } from "@jest/globals";
import { LintRunConfiguration } from "src/core/lint_run_configuration";
import { SourceText } from "src/source_text";
import { NodeFileIO } from "src/io/node_file_io";
import { TestFixture } from "tests/core/test-fixture";

describe("coding-lint assertion and exception policy", () => {
	test("rejects bare Python assert statements in tests", () => {
		const fixture = new TestFixture();
		const violations = fixture.with_lint_request(
			new LintRunConfiguration(new SourceText(), new NodeFileIO()),
			{
				"tests/service_test.py": [
					"import unittest",
					"",
					"class TestService(unittest.TestCase):",
					"    def test_bare_assert(self):",
					"        assert load_service() == expected_service",
					"",
					"    def test_unittest_assert(self):",
					"        self.assertEqual(load_service(), expected_service)",
				].join("\n"),
				"service.py": "def validate_service():\n    assert service_is_valid",
			},
			(production_lint_configuration, options, mode) =>
				production_lint_configuration.lint_report(options, mode).report.violations,
		);
		const assertions = violations.filter((item) => item.rule_id === "python-test-assert-statement");

		expect({ count: assertions.length, line: assertions[0]?.line }).toEqual({ count: 1, line: 5 });
	});

	test("rejects raise and throw in TypeScript and Python tests only", () => {
		const fixture = new TestFixture();
		const violations = fixture.with_lint_request(
			new LintRunConfiguration(new SourceText(), new NodeFileIO()),
			{
				"tests/service.test.ts": 'function load_service(): never { throw new Error("failed"); }',
				"tests/service_test.py": 'def load_service():\n    raise RuntimeError("failed")',
				"tests/support/io_adapter.ts": 'function read_adapter(): never { throw new Error("failure"); }',
				"tests/support/io_adapter.py": 'def read_adapter():\n    raise RuntimeError("failure")',
				"service.ts": 'function load_service(): never { throw new Error("failed"); }',
				"service.py": 'def load_service():\n    raise RuntimeError("failed")',
			},
			(production_lint_configuration, options, mode) =>
				production_lint_configuration.lint_report(options, mode).report.violations,
		);
		const exception_violations = violations.filter((item) => item.rule_id === "exception-raising");

		expect({
			count: exception_violations.length,
			typescript_test: exception_violations.some((item) => item.file.endsWith("/service.test.ts")),
			python_test: exception_violations.some((item) => item.file.endsWith("/service_test.py")),
			support_modules_excluded: exception_violations.every((item) => !item.file.includes("/support/")),
			typescript_production: exception_violations.some((item) => item.file.endsWith("/service.ts")),
			python_production: exception_violations.some((item) => item.file.endsWith("/service.py")),
		}).toEqual({
			count: 2,
			typescript_test: true,
			python_test: true,
			support_modules_excluded: true,
			typescript_production: false,
			python_production: false,
		});
	});
});
