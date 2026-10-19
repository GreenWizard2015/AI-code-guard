import { describe, expect, test } from "@jest/globals";
import { LintRunConfiguration } from "src/core/lint_run_configuration";
import { SourceText } from "src/source_text";
import { NodeFileIO } from "src/io/node_file_io";
import { TestFixture } from "tests/core/test-fixture";

describe("TypeScript namespace file rules", () => {
	test("allows imports and one namespace only", () => {
		const test_fixture = new TestFixture();
		const violations = test_fixture.with_lint_request(
			new LintRunConfiguration(new SourceText(), new NodeFileIO()),
			{
				"valid-namespace.ts": [
					"import { value } from './value';",
					"namespace Scope {",
					"\texport const result = value;",
					"}",
				].join("\n"),
			},
			(production_lint_configuration, options, mode) =>
				production_lint_configuration.lint_report(options, mode).report.violations,
		);

		expect(violations.filter((item) => item.rule_id === "typescript-namespace-file")).toHaveLength(0);
	});

	test("rejects multiple namespaces and code outside the namespace", () => {
		const test_fixture = new TestFixture();
		const violations = test_fixture.with_lint_request(
			new LintRunConfiguration(new SourceText(), new NodeFileIO()),
			{
				"invalid-namespace.ts": ["namespace First {}", "namespace Second {}", "const outside = 1;"].join("\n"),
			},
			(production_lint_configuration, options, mode) =>
				production_lint_configuration.lint_report(options, mode).report.violations,
		);

		expect(violations.filter((item) => item.rule_id === "typescript-namespace-file")).toHaveLength(1);
	});

	test("applies ordinary TypeScript rules inside the namespace", () => {
		const test_fixture = new TestFixture();
		const violations = test_fixture.with_lint_request(
			new LintRunConfiguration(new SourceText(), new NodeFileIO()),
			{
				"namespace-content.ts": [
					"namespace Scope {",
					"\texport function read(value: unknown): any {",
					"\t\treturn value;",
					"\t}",
					"}",
				].join("\n"),
			},
			(production_lint_configuration, options, mode) =>
				production_lint_configuration.lint_report(options, mode).report.violations,
		);

		expect(violations.some((item) => item.rule_id === "type-info")).toBe(true);
		expect(violations.some((item) => item.rule_id === "typescript-unknown-parameter-type")).toBe(true);
	});
});
