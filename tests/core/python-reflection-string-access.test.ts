import { describe, expect, test } from "@jest/globals";
import { LintRunConfiguration } from "src/core/lint_run_configuration";
import { SourceText } from "src/source_text";
import { NodeFileIO } from "src/io/node_file_io";
import { TestFixture } from "tests/core/test-fixture";

describe("Python reflection string access", () => {
	test("reports static f-string reads that bypass private ownership", () => {
		const fixture = new TestFixture();
		const violations = fixture.with_lint_request(
			new LintRunConfiguration(new SourceText(), new NodeFileIO()),
			{
				"private-fstring-read.py": [
					"class Sample:",
					"    def __init__(self):",
					"        self._secret = 1",
					"sample = Sample()",
					'getattr(sample, f"_secret")',
					'sample.__getattribute__(f"_secret")',
					'sample.__dict__[f"_secret"]',
				].join("\n"),
			},
			(production_lint_configuration, options, mode) =>
				production_lint_configuration.lint_report(options, mode).report.violations,
		);
		expect(
			violations.filter(
				(item) => item.message === "private class members must not be accessed from outside their class",
			),
		).toHaveLength(3);
	});

	test("reports static f-string writes that bypass private ownership", () => {
		const fixture = new TestFixture();
		const violations = fixture.with_lint_request(
			new LintRunConfiguration(new SourceText(), new NodeFileIO()),
			{
				"private-fstring-write.py": [
					"class Sample:",
					"    def __init__(self):",
					"        self._secret = 1",
					"sample = Sample()",
					'setattr(sample, f"_secret", 2)',
					'sample.__setattr__(f"_secret", 2)',
					'sample.__dict__[f"_secret"] = 2',
				].join("\n"),
			},
			(production_lint_configuration, options, mode) =>
				production_lint_configuration.lint_report(options, mode).report.violations,
		);
		expect(
			violations.filter(
				(item) => item.message === "private class members must not be accessed from outside their class",
			),
		).toHaveLength(3);
	});
});
