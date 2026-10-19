import { describe, expect, test } from "@jest/globals";
import { LintRunConfiguration } from "src/core/lint_run_configuration";
import { SourceText } from "src/source_text";
import { NodeFileIO } from "src/io/node_file_io";
import { TestFixture } from "tests/core/test-fixture";

describe("TypeScript type alias rules", () => {
	test("reports a top-level bare alias", () => {
		const fixture = new TestFixture();
		const execution = fixture.with_lint_request(
			new LintRunConfiguration(new SourceText(), new NodeFileIO()),
			{
				"aliases.ts": ["type ExistingShape = { value: string };", "type CandidateAlias = ExistingShape;"].join("\n"),
			},
			(production_lint_configuration, options, mode) => production_lint_configuration.lint_report(options, mode),
		);

		expect(execution.report.violations.filter((item) => item.rule_id === "typescript-bare-type-alias")).toHaveLength(1);
	});

	test("reports bare aliases nested one or more namespace levels", () => {
		const fixture = new TestFixture();
		const execution = fixture.with_lint_request(
			new LintRunConfiguration(new SourceText(), new NodeFileIO()),
			{
				"namespace-aliases.ts": [
					"type ExistingShape = { value: string };",
					"namespace TypeScope {",
					"  export type CandidateAlias = ExistingShape;",
					"}",
				].join("\n"),
				"nested-namespace-aliases.ts": [
					"type ExistingShape = { value: string };",
					"namespace TypeScope {",
					"  export namespace Nested {",
					"    export type CandidateAlias = ExistingShape;",
					"  }",
					"}",
				].join("\n"),
			},
			(production_lint_configuration, options, mode) => production_lint_configuration.lint_report(options, mode),
		);

		expect(execution.report.violations.filter((item) => item.rule_id === "typescript-bare-type-alias")).toHaveLength(2);
	});
});
