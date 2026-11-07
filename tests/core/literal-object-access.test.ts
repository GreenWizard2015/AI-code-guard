import { describe, expect, test } from "@jest/globals";
import { LintRunConfiguration } from "src/core/lint_run_configuration";
import { NodeFileIO } from "src/io/node_file_io";
import { SourceText } from "src/io/source_text";
import { TestFixture } from "tests/core/test-fixture";

describe("literal object access rule", () => {
	test("reports TypeScript string-literal access and permits a variable key", () => {
		const fixture = new TestFixture();
		const violations = fixture.with_lint_request(
			new LintRunConfiguration(new SourceText(), new NodeFileIO(process.cwd())),
			{
				"literal-access.ts": [
					"type Entry = { name: string };",
					"declare const entry: Entry;",
					"declare const key: keyof Entry;",
					'const literal_value = entry["name"];',
					"const dynamic_value = entry[key];",
				].join("\n"),
			},
			(production_lint_configuration, options, mode) =>
				production_lint_configuration.lint_report(options, mode).report.violations,
		);

		expect(
			violations.filter((item) => item.rule_id() === "typescript-literal-object-access").map((item) => item.line()),
		).toEqual([4]);
	});

	test("permits direct member access", () => {
		const fixture = new TestFixture();
		const violations = fixture.with_lint_request(
			new LintRunConfiguration(new SourceText(), new NodeFileIO(process.cwd())),
			{
				"direct-access.ts": [
					"type Entry = { name: string };",
					"declare const entry: Entry;",
					"const value = entry.name;",
				].join("\n"),
			},
			(production_lint_configuration, options, mode) =>
				production_lint_configuration.lint_report(options, mode).report.violations,
		);

		expect(violations.filter((item) => item.rule_id() === "typescript-literal-object-access")).toEqual([]);
	});
});
