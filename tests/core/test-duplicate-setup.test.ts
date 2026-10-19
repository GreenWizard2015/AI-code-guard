import { describe, expect, test } from "@jest/globals";
import { LintRunConfiguration } from "src/core/lint_run_configuration";
import { SourceText } from "src/source_text";
import { NodeFileIO } from "src/io/node_file_io";
import { TestFixture } from "tests/core/test-fixture";

describe("duplicate test setup analysis", () => {
	test("reports adjacent duplicate setup in Jest and unittest methods", () => {
		const fixture = new TestFixture();
		const violations = fixture.with_lint_request(
			new LintRunConfiguration(new SourceText(), new NodeFileIO()),
			{
				"duplicate.test.ts": [
					'describe("records", () => {',
					'test("loads", () => {',
					"  reset_store();",
					"  reset_store();",
					"  expect(load_record()).toEqual(record);",
					"});",
					'test("other", () => {',
					"  reset_store();",
					"  reset_store();",
					"  expect(load_record()).toEqual(record);",
					"});",
					"});",
				].join("\n"),
				"duplicate_test.py": [
					"import unittest",
					"class SetupTests(unittest.TestCase):",
					"    def test_loads(self) -> None:",
					"        reset_store()",
					"        reset_store()",
					"        self.assertEqual(load_record(), record)",
				].join("\n"),
			},
			(production_lint_configuration, options, mode) =>
				production_lint_configuration.lint_report(options, mode).report.violations,
		);
		expect(violations.filter((item) => item.rule_id === "test-duplicate-setup")).toHaveLength(3);
	});

	test("ignores separated, nested, and assertion setup calls as well as string contents", () => {
		const fixture = new TestFixture();
		const violations = fixture.with_lint_request(
			new LintRunConfiguration(new SourceText(), new NodeFileIO()),
			{
				"non-adjacent.test.ts": [
					'describe("records", () => {',
					'test("loads", () => {',
					"  reset_store();",
					"  load_record();",
					"  reset_store();",
					"  if (enabled) { reset_store(); reset_store(); }",
					"  expect(load_record()).toEqual(record);",
					"});",
					'test("other", () => {',
					"  expect(load_record()).toEqual(record);",
					"  reset_store();",
					"  reset_store();",
					"});",
					"});",
				].join("\n"),
				"non-adjacent_test.py": [
					"import unittest",
					"class SetupTests(unittest.TestCase):",
					"    def test_loads(self) -> None:",
					"        reset_store()",
					"        load_record()",
					"        reset_store()",
					"        self.assertEqual(load_record(), record)",
				].join("\n"),
				"tests/literal-setup.test.ts": [
					"describe('records', () => {",
					"\ttest('loads', () => {",
					"\t\tseed('a b');",
					"\t\tseed('ab');",
					"\t\texpect(load_record()).toEqual(record);",
					"\t});",
					"});",
				].join("\n"),
			},
			(production_lint_configuration, options, mode) =>
				production_lint_configuration.lint_report(options, mode).report.violations,
		);
		expect(violations.filter((item) => item.rule_id === "test-duplicate-setup")).toHaveLength(0);
	});
});
