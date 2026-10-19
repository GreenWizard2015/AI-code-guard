import { describe, expect, test } from "@jest/globals";
import { LintRunConfiguration } from "src/core/lint_run_configuration";
import { SourceText } from "src/source_text";
import { NodeFileIO } from "src/io/node_file_io";
import { TestFixture } from "tests/core/test-fixture";

describe("Python typed callable ownership", () => {
	const test_fixture = new TestFixture();

	test("resolves methods called on temporary class instances", () => {
		const violations = test_fixture.with_lint_request(
			new LintRunConfiguration(new SourceText(), new NodeFileIO()),
			{
				"selector.py": ["class Selector:", "    def select(self):", '        return "selected"'].join("\n"),
				"caller.py": ["from selector import Selector", "def run():", "    return Selector().select()"].join("\n"),
			},
			(production_lint_configuration, options, mode) =>
				production_lint_configuration.lint_report(options, mode).report.violations,
		);

		expect(
			violations.some((violation) =>
				violation.message.includes('method "Selector.select" has insufficient production usage (found 0'),
			),
		).toBe(false);
	});

	test("does not report unused methods declared by a Python Protocol", () => {
		const violations = test_fixture.with_lint_request(
			new LintRunConfiguration(new SourceText(), new NodeFileIO()),
			{
				"protocols.py": [
					"from typing import Protocol",
					"",
					"class ServicePort(Protocol):",
					"    def run(self) -> None: ...",
				].join("\n"),
			},
			(production_lint_configuration, options, mode) =>
				production_lint_configuration.lint_report(options, mode).report.violations,
		);

		expect(violations.some((violation) => violation.rule_id === "unused-callable")).toBe(false);
	});

	test("reports Python temporary class aliases", () => {
		const rule_ids = test_fixture
			.with_lint_request(
				new LintRunConfiguration(new SourceText(), new NodeFileIO()),
				{
					"temporary-instance-alias.py": [
						"class Reader:",
						"    def read(self):",
						"        pass",
						"",
						"reader_factory = Reader",
						"reader_factory().read()",
					].join("\n"),
				},
				(production_lint_configuration, options, mode) =>
					production_lint_configuration.lint_report(options, mode).report.violations,
			)
			.map((violation) => violation.rule_id);

		expect(rule_ids).toContain("temporary-result-access");
	});
});
