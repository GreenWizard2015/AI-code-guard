import { describe, expect, test } from "@jest/globals";
import { LintRunConfiguration } from "src/core/lint_run_configuration";
import { NodeFileIO } from "src/io/node_file_io";
import { SourceText } from "src/io/source_text";
import { TestFixture } from "tests/core/test-fixture";

describe("inline assertion object literals", () => {
	test("reports object literal aliases used only by equality assertions in both languages", () => {
		const fixture = new TestFixture();
		const violations = fixture.with_lint_request(
			new LintRunConfiguration(new SourceText(), new NodeFileIO(process.cwd())),
			{
				"tests/status.test.ts": [
					'describe("status", () => {',
					'test("matches", () => {',
					'  const actual = { status: "ready" };',
					'  const expected = { status: "ready" };',
					"  expect(actual).toEqual(expected);",
					"});",
					'test("does not report reused aliases", () => {',
					'  const actual = { status: "ready" };',
					'  const expected = { status: "ready" };',
					"  consume(actual);",
					"  consume(expected);",
					"  expect(actual).toEqual(expected);",
					"});",
					"});",
				].join("\n"),
				"tests/status_test.py": [
					"import unittest",
					"",
					"class StatusTests(unittest.TestCase):",
					"    def test_matches(self) -> None:",
					'        actual = {"status": "ready"}',
					'        expected = {"status": "ready"}',
					"        self.assertEqual(actual, expected)",
					"",
					"    def test_does_not_report_reused_aliases(self) -> None:",
					'        actual = {"status": "ready"}',
					'        expected = {"status": "ready"}',
					"        consume(actual)",
					"        consume(expected)",
					"        self.assertEqual(actual, expected)",
				].join("\n"),
			},
			(production_lint_configuration, options, mode) =>
				production_lint_configuration.lint_report(options, mode).report.violations,
		);

		expect(
			violations
				.filter((item) => item.rule_id() === "inline-assertion-object-literals")
				.map((item) => [item.file(), item.line()]),
		).toEqual([
			["tests/status.test.ts", 5],
			["tests/status_test.py", 7],
		]);
	});

	test("reports an alias used by equality after it was independently observed", () => {
		const fixture = new TestFixture();
		const violations = fixture.with_lint_request(
			new LintRunConfiguration(new SourceText(), new NodeFileIO(process.cwd())),
			{
				"tests/partial.test.ts": [
					'describe("partial equality", () => {',
					'test("inlines the compared value", () => {',
					'  const actual = { status: "ready" };',
					'  const expected = { status: "ready" };',
					"  record(actual);",
					"  expect(actual).toEqual(expected);",
					"});",
					"});",
				].join("\n"),
			},
			(production_lint_configuration, options, mode) =>
				production_lint_configuration.lint_report(options, mode).report.violations,
		);

		expect(
			violations
				.filter((item) => item.rule_id() === "inline-assertion-object-literals")
				.map((item) => [item.file(), item.line()]),
		).toEqual([["tests/partial.test.ts", 6]]);
	});

	test("accepts object literals passed directly to equality assertions", () => {
		const fixture = new TestFixture();
		const violations = fixture.with_lint_request(
			new LintRunConfiguration(new SourceText(), new NodeFileIO(process.cwd())),
			{
				"tests/inline.test.ts": [
					'describe("inline equality", () => {',
					'test("compares direct values", () => {',
					'  expect({ status: "ready" }).toEqual({ status: "ready" });',
					"});",
					"});",
				].join("\n"),
				"tests/inline_test.py": [
					"import unittest",
					"class InlineTests(unittest.TestCase):",
					"    def test_compares_direct_values(self) -> None:",
					'        self.assertEqual({"status": "ready"}, {"status": "ready"})',
				].join("\n"),
			},
			(production_lint_configuration, options, mode) =>
				production_lint_configuration.lint_report(options, mode).report.violations,
		);

		expect(violations.filter((item) => item.rule_id() === "inline-assertion-object-literals")).toEqual([]);
	});
});
