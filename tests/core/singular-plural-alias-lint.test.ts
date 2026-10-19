import { describe, expect, test } from "@jest/globals";
import { LintRunConfiguration } from "src/core/lint_run_configuration";
import { SourceText } from "src/source_text";
import { NodeFileIO } from "src/io/node_file_io";
import { TestFixture } from "tests/core/test-fixture";

describe("singular plural alias rule", () => {
	test("reports direct field aliases", () => {
		const fixture = new TestFixture();
		const execution = fixture.with_lint_request(
			new LintRunConfiguration(new SourceText(), new NodeFileIO()),
			{
				"interface-alias.ts": "type Control = { item?: string; items?: string[]; };",
			},
			(production_lint_configuration, options, mode) => production_lint_configuration.lint_report(options, mode),
		);

		expect(
			execution.report.violations.filter((item) => item.rule_id === "typescript-singular-plural-alias"),
		).toHaveLength(2);
	});

	test("resolves aliases through direct and multiple interface inheritance", () => {
		const fixture = new TestFixture();
		const execution = fixture.with_lint_request(
			new LintRunConfiguration(new SourceText(), new NodeFileIO()),
			{
				"direct-inheritance.ts": [
					"interface SingularPart { item?: string; }",
					"interface PluralPart { items?: string[]; }",
					"interface Candidate extends SingularPart, PluralPart { validate(): boolean; }",
				].join("\n"),
				"nested-inheritance.ts": [
					"interface ItemPart { item?: string; }",
					"interface SingularPart extends ItemPart {}",
					"interface PluralPart { items?: string[]; }",
					"interface Candidate extends SingularPart, PluralPart { validate(): boolean; }",
				].join("\n"),
			},
			(production_lint_configuration, options, mode) => production_lint_configuration.lint_report(options, mode),
		);

		expect(
			execution.report.violations.filter((item) => item.rule_id === "typescript-singular-plural-alias"),
		).toHaveLength(2);
	});
});
