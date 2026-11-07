import { describe, expect, test } from "@jest/globals";
import { LintRunConfiguration } from "src/core/lint_run_configuration";
import { NodeFileIO } from "src/io/node_file_io";
import { SourceText } from "src/io/source_text";
import { TestFixture } from "tests/core/test-fixture";

describe("rest union aliases", () => {
	test("resolves direct and nested namespace aliases", () => {
		const fixture = new TestFixture();
		const execution = fixture.with_lint_request(
			new LintRunConfiguration(new SourceText(), new NodeFileIO(process.cwd())),
			{
				"named.ts": [
					"namespace ValueTypes {",
					"  export type CandidateValue = string | number;",
					"}",
					"function collect_named_namespace(...values: ValueTypes.CandidateValue[]): void {}",
				].join("\n"),
				"nested.ts": [
					"namespace ValueTypes {",
					"  export namespace Nested {",
					"    export type CandidateValue = string | number;",
					"  }",
					"}",
					"function collect_nested(...values: ValueTypes.Nested.CandidateValue[]): void {}",
				].join("\n"),
			},
			(production_lint_configuration, options, mode) => production_lint_configuration.lint_report(options, mode),
		);

		expect(
			execution.report.violations.filter((item) => item.rule_id() === "typescript-rest-union-contract"),
		).toHaveLength(2);
	});

	test("resolves imported union aliases", () => {
		const fixture = new TestFixture();
		const execution = fixture.with_lint_request(
			new LintRunConfiguration(new SourceText(), new NodeFileIO(process.cwd())),
			{
				"types.ts": 'export type MetricViolationKind = "info" | "warning";\n',
				"collector.ts": [
					'import type { MetricViolationKind } from "./types";',
					"export function collect_kinds(...kinds: MetricViolationKind[]): void {}",
				].join("\n"),
			},
			(production_lint_configuration, options, mode) => production_lint_configuration.lint_report(options, mode),
		);

		expect(
			execution.report.violations.filter((item) => item.rule_id() === "typescript-rest-union-contract"),
		).toHaveLength(1);
	});

	test("expands shared nested aliases once during rest-union reachability", () => {
		const depth = 8;
		const aliases = [
			"type Layer0 = string;",
			...Array.from({ length: depth }, (_, index) => `type Layer${index + 1} = [Layer${index}, Layer${index}];`),
		];
		const source_lines = [...aliases, `export function consume(...values: Layer${depth}): void {}`];
		const source = source_lines.join("\n");
		const fixture = new TestFixture();
		const matching_violations = fixture
			.with_lint_request(
				new LintRunConfiguration(new SourceText(), new NodeFileIO(process.cwd())),
				{ "shared-rest-aliases.ts": source },
				(production_lint_configuration, options, mode) =>
					production_lint_configuration.lint_report(options, mode).report.violations,
			)
			.filter((item) => item.rule_id() === "typescript-rest-union-contract").length;
		expect(matching_violations).toBe(0);
	});
});
