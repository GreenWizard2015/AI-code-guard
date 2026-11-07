import { describe, expect, test } from "@jest/globals";
import { LintRunConfiguration } from "src/core/lint_run_configuration";
import { NodeFileIO } from "src/io/node_file_io";
import { SourceText } from "src/io/source_text";
import { TestFixture } from "tests/core/test-fixture";

describe("lexical binding analysis in conditional expressions", () => {
	test("allows short-circuit reads of shadowing function-local values", () => {
		const fixture = new TestFixture();
		const violations = fixture
			.with_lint_request(
				new LintRunConfiguration(new SourceText(), new NodeFileIO(process.cwd())),
				{
					"shadowed-conditions.ts": [
						"const left: string = '';",
						"const right: string = '';",
						"function candidate(): object {",
						"\tconst left = {};",
						"\tconst right = {};",
						"\tconst result = left || right;",
						"\treturn result;",
						"}",
					].join("\n"),
				},
				(production_lint_configuration, options, mode) =>
					production_lint_configuration.lint_report(options, mode).report.violations,
			)
			.filter((item) => item.rule_id() === "conditional-execution");
		expect(violations).toEqual([]);
	});

	test("allows a shadowing object value with a data-only fallback", () => {
		const fixture = new TestFixture();
		const violations = fixture
			.with_lint_request(
				new LintRunConfiguration(new SourceText(), new NodeFileIO(process.cwd())),
				{
					"shadowed-boolean.ts": [
						"const enabled: boolean = true;",
						"function candidate(): object {",
						"\tconst enabled = {};",
						"\tconst result = enabled || {};",
						"\treturn result;",
						"}",
					].join("\n"),
				},
				(production_lint_configuration, options, mode) =>
					production_lint_configuration.lint_report(options, mode).report.violations,
			)
			.filter((item) => item.rule_id() === "conditional-execution");
		expect(violations).toEqual([]);
	});

	test("reports a non-boolean call after a shadowing object value", () => {
		const fixture = new TestFixture();
		const violations = fixture.with_lint_request(
			new LintRunConfiguration(new SourceText(), new NodeFileIO(process.cwd())),
			{
				"shadowed-call.ts": [
					"declare function load_object(): object;",
					"const enabled: boolean = true;",
					"function candidate(): object {",
					"\tconst enabled = {};",
					"\tconst result = enabled || load_object();",
					"\treturn result;",
					"}",
				].join("\n"),
			},
			(production_lint_configuration, options, mode) =>
				production_lint_configuration.lint_report(options, mode).report.violations,
		);
		const findings = violations.filter((item) => item.rule_id() === "conditional-execution");
		expect(findings.map((item) => `${item.file()}:${item.line()}`)).toEqual(["shadowed-call.ts:5"]);
	});
});
