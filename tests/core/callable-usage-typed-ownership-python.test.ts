import { describe, expect, test } from "@jest/globals";
import { LintRunConfiguration } from "src/core/lint_run_configuration";
import { NodeFileIO } from "src/io/node_file_io";
import { SourceText } from "src/io/source_text";
import { TestFixture } from "tests/core/test-fixture";

describe("Python typed callable ownership", () => {
	const test_fixture = new TestFixture();

	test("resolves methods called on temporary class instances", () => {
		const violations = test_fixture.with_lint_request(
			new LintRunConfiguration(new SourceText(), new NodeFileIO(process.cwd())),
			{
				"selector.py": ["class Selector:", "    def select(self):", '        return "selected"'].join("\n"),
				"caller.py": ["from selector import Selector", "def run():", "    return Selector().select()"].join("\n"),
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
		);
		const selector_unused_locations = violations
			.filter(
				(violation) =>
					violation.rule_id() === "unused-callable" &&
					violation.message().includes('method "Selector.select" has insufficient production usage'),
			)
			.map((violation) => `${violation.file()}:${violation.line()}`);
		const temporary_alias_locations = violations
			.filter(
				(violation) =>
					violation.rule_id() === "temporary-result-access" && violation.file() === "temporary-instance-alias.py",
			)
			.map((violation) => `${violation.file()}:${violation.line()}`);

		expect({ selector_unused_locations, temporary_alias_locations }).toEqual({
			selector_unused_locations: [],
			temporary_alias_locations: ["temporary-instance-alias.py:6"],
		});
	});

	test("does not report unused methods declared by a Python Protocol", () => {
		const violations = test_fixture.with_lint_request(
			new LintRunConfiguration(new SourceText(), new NodeFileIO(process.cwd())),
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
		const protocol_unused_locations = violations
			.filter((violation) => violation.rule_id() === "unused-callable" && violation.file() === "protocols.py")
			.map((violation) => `${violation.file()}:${violation.line()}`);

		expect(protocol_unused_locations).toEqual([]);
	});
});
