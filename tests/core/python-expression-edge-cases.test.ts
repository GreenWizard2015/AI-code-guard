import { describe, expect, test } from "@jest/globals";
import { LintRunConfiguration } from "src/core/lint_run_configuration";
import { SourceText } from "src/source_text";
import { NodeFileIO } from "src/io/node_file_io";
import { TestFixture } from "tests/core/test-fixture";

describe("Python expression edge cases", () => {
	test("allows ordinary Python assignments", () => {
		const fixture = new TestFixture();
		const messages = fixture
			.with_lint_request(
				new LintRunConfiguration(new SourceText(), new NodeFileIO()),
				{ "assignment.py": "value = 1\n" },
				(production_lint_configuration, options, mode) =>
					production_lint_configuration.lint_report(options, mode).report.violations,
			)
			.map((violation) => violation.message);

		expect({
			assignment: messages.filter((message) => message === "avoid Python assignment expressions").length,
			ternary: messages.filter((message) => message === "avoid ternary expressions").length,
		}).toEqual({ assignment: 0, ternary: 0 });
	});

	test("reports non-primitive Python ternaries", () => {
		const fixture = new TestFixture();
		const messages = fixture
			.with_lint_request(
				new LintRunConfiguration(new SourceText(), new NodeFileIO()),
				{ "ternary.py": "value = make_value() if enabled else fallback\n" },
				(production_lint_configuration, options, mode) =>
					production_lint_configuration.lint_report(options, mode).report.violations,
			)
			.map((violation) => violation.message);
		expect({
			has_ternary: messages.includes("avoid ternary expressions"),
			ternary_count: messages.filter((message) => message === "avoid ternary expressions").length,
			has_assignment: messages.includes("avoid Python assignment expressions"),
		}).toEqual({ has_ternary: true, ternary_count: 1, has_assignment: false });
	});

	test("reports assignment expressions inside conditions", () => {
		const fixture = new TestFixture();
		const messages = fixture
			.with_lint_request(
				new LintRunConfiguration(new SourceText(), new NodeFileIO()),
				{ "condition.py": "if (value := load_value()):\n    pass\n" },
				(production_lint_configuration, options, mode) =>
					production_lint_configuration.lint_report(options, mode).report.violations,
			)
			.map((violation) => violation.message);
		expect(messages.filter((message) => message === "avoid Python assignment expressions")).toHaveLength(1);
	});
});
