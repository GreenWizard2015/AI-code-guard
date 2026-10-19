import { describe, expect, test } from "@jest/globals";
import { LintRunConfiguration } from "src/core/lint_run_configuration";
import { SourceText } from "src/source_text";
import { NodeFileIO } from "src/io/node_file_io";
import { TestFixture } from "tests/core/test-fixture";

describe("top-level single-item array state", () => {
	test("rejects a zero-index value followed by an undefined guard", () => {
		const fixture = new TestFixture();
		const execution = fixture.with_lint_request(
			new LintRunConfiguration(new SourceText(), new NodeFileIO()),
			{
				"array-guard.ts": [
					"let candidate_items: string[] = [];",
					"const candidate_first = candidate_items[0];",
					"if (candidate_first !== undefined) {",
					"  console.log(candidate_first);",
					"}",
				].join("\n"),
			},
			(production_lint_configuration, options, mode) => production_lint_configuration.lint_report(options, mode),
		);

		expect(execution.report.violations.filter((item) => item.rule_id === "single-item-array-state")).toHaveLength(1);
	});

	test("rejects the inverse top-level undefined guard", () => {
		const fixture = new TestFixture();
		const execution = fixture.with_lint_request(
			new LintRunConfiguration(new SourceText(), new NodeFileIO()),
			{
				"array-guard.ts": [
					"let candidate_items: string[] = [];",
					"const candidate_first = candidate_items[0];",
					"if (candidate_first === undefined) {",
					'  console.log("missing");',
					"}",
				].join("\n"),
			},
			(production_lint_configuration, options, mode) => production_lint_configuration.lint_report(options, mode),
		);

		expect(execution.report.violations.filter((item) => item.rule_id === "single-item-array-state")).toHaveLength(1);
	});
});
