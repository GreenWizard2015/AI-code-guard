import { describe, expect, test } from "@jest/globals";
import { LintRunConfiguration } from "src/core/lint_run_configuration";
import { SourceText } from "src/source_text";
import { NodeFileIO } from "src/io/node_file_io";
import { TestFixture } from "tests/core/test-fixture";

describe("TypeScript type alias resolution", () => {
	test("reports unbounded aliases declared inside callables", () => {
		const fixture = new TestFixture();
		const execution = fixture.with_lint_request(
			new LintRunConfiguration(new SourceText(), new NodeFileIO()),
			{
				"unbounded-local-alias.ts": [
					"function control(value: any): string {",
					'  return "";',
					"}",
					"",
					"function candidate(): void {",
					"  type Hidden = any;",
					"  function inner(value: Hidden): string {",
					'    return "";',
					"  }",
					"  inner(1);",
					"}",
				].join("\n"),
			},
			(production_lint_configuration, options, mode) => production_lint_configuration.lint_report(options, mode),
		);

		expect(execution.report.violations.filter((item) => item.rule_id === "unbounded-type")).toHaveLength(2);
	});

	test("reports unbounded aliases declared inside namespaces", () => {
		const fixture = new TestFixture();
		const execution = fixture.with_lint_request(
			new LintRunConfiguration(new SourceText(), new NodeFileIO()),
			{
				"unbounded-namespace-alias.ts": [
					"namespace Scope {",
					"  type Hidden = unknown;",
					'  function read(value: Hidden): string { return ""; }',
					"}",
				].join("\n"),
			},
			(production_lint_configuration, options, mode) => production_lint_configuration.lint_report(options, mode),
		);

		expect(execution.report.violations.filter((item) => item.rule_id === "unbounded-type")).toHaveLength(2);
	});
});
