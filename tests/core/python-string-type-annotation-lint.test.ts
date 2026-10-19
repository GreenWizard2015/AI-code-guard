import { describe, expect, test } from "@jest/globals";
import { LintRunConfiguration } from "src/core/lint_run_configuration";
import { SourceText } from "src/source_text";
import { NodeFileIO } from "src/io/node_file_io";
import { TestFixture } from "tests/core/test-fixture";

describe("Python string type annotations", () => {
	test("reports quoted field, parameter, and return annotations", () => {
		const fixture = new TestFixture();
		const execution = fixture.with_lint_request(
			new LintRunConfiguration(new SourceText(), new NodeFileIO()),
			{
				"service.py": [
					"class Service:",
					'    model: "Model"',
					"",
					'    def load(self, value: "Model") -> "Model":',
					"        return value",
				].join("\n"),
			},
			(production_lint_configuration, options, mode) => production_lint_configuration.lint_report(options, mode),
		);

		expect(
			execution.report.violations.filter((violation) => violation.rule_id === "python-string-type-annotation"),
		).toHaveLength(3);
	});

	test("allows direct annotations", () => {
		const fixture = new TestFixture();
		const execution = fixture.with_lint_request(
			new LintRunConfiguration(new SourceText(), new NodeFileIO()),
			{
				"service.py": [
					"class Service:",
					"    model: Model",
					"",
					"    def load(self, value: Model) -> Model:",
					"        return value",
				].join("\n"),
			},
			(production_lint_configuration, options, mode) => production_lint_configuration.lint_report(options, mode),
		);

		expect(
			execution.report.violations.filter((violation) => violation.rule_id === "python-string-type-annotation"),
		).toHaveLength(0);
	});
});
