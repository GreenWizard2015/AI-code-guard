import { describe, expect, test } from "@jest/globals";
import { LintRunConfiguration } from "src/core/lint_run_configuration";
import { SourceText } from "src/source_text";
import { NodeFileIO } from "src/io/node_file_io";
import { TestFixture } from "tests/core/test-fixture";

describe("lexical binding analysis in conditional expressions", () => {
	test("resolves short-circuit operands using shadowing function-local values", () => {
		const fixture = new TestFixture();
		const violations = fixture
			.with_lint_request(
				new LintRunConfiguration(new SourceText(), new NodeFileIO()),
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
			.filter((item) => item.rule_id === "conditional-execution").length;
		expect(violations).toBe(1);
	});

	test("does not use shadowed module booleans when classifying conditions", () => {
		const fixture = new TestFixture();
		const violations = fixture
			.with_lint_request(
				new LintRunConfiguration(new SourceText(), new NodeFileIO()),
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
			.filter((item) => item.rule_id === "conditional-execution").length;
		expect(violations).toBe(1);
	});
});
