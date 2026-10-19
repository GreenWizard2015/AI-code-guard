import { describe, expect, jest, test } from "@jest/globals";
import { LintRunConfiguration } from "src/core/lint_run_configuration";
import { SourceText } from "src/source_text";
import { NodeFileIO } from "src/io/node_file_io";
import { TestFixture } from "tests/core/test-fixture";
import { RestUnionImportedAliases } from "src/rules/typescript/syntax-rules/types/rest_union_imported_aliases";

describe("rest union aliases", () => {
	test("resolves direct and nested namespace aliases", () => {
		const fixture = new TestFixture();
		const execution = fixture.with_lint_request(
			new LintRunConfiguration(new SourceText(), new NodeFileIO()),
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
			execution.report.violations.filter((item) => item.rule_id === "typescript-rest-union-contract"),
		).toHaveLength(2);
	});

	test("resolves imported union aliases", () => {
		const fixture = new TestFixture();
		const execution = fixture.with_lint_request(
			new LintRunConfiguration(new SourceText(), new NodeFileIO()),
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
			execution.report.violations.filter((item) => item.rule_id === "typescript-rest-union-contract"),
		).toHaveLength(1);
	});

	test("prepares the source alias environment once for many rest parameters", () => {
		const parameter_count = 30;
		const source = Array.from(
			{ length: parameter_count },
			(_, index) => `export function consume_${index}(...values: string[]): void {}`,
		).join("\n");
		const append_local = jest.spyOn(RestUnionImportedAliases.prototype, "append_local");
		const fixture = new TestFixture();
		let matching_violations = 0;
		let alias_preparations = 0;
		try {
			matching_violations = fixture
				.with_lint_request(
					new LintRunConfiguration(new SourceText(), new NodeFileIO()),
					{ "many-rest-parameters.ts": source },
					(production_lint_configuration, options, mode) =>
						production_lint_configuration.lint_report(options, mode).report.violations,
				)
				.filter((item) => item.rule_id === "typescript-rest-union-contract").length;
			alias_preparations = append_local.mock.calls.length;
		} finally {
			append_local.mockRestore();
		}
		expect({ matching_violations, alias_preparations }).toEqual({ matching_violations: 0, alias_preparations: 1 });
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
				new LintRunConfiguration(new SourceText(), new NodeFileIO()),
				{ "shared-rest-aliases.ts": source },
				(production_lint_configuration, options, mode) =>
					production_lint_configuration.lint_report(options, mode).report.violations,
			)
			.filter((item) => item.rule_id === "typescript-rest-union-contract").length;
		expect(matching_violations).toBe(0);
	});
});
