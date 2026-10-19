import { describe, expect, test } from "@jest/globals";
import { LintRunConfiguration } from "src/core/lint_run_configuration";
import { SourceText } from "src/source_text";
import { NodeFileIO } from "src/io/node_file_io";
import { TestFixture } from "tests/core/test-fixture";

describe("object-literal return analysis", () => {
	test("detects callable object returns through direct and wrapped contract types", () => {
		const fixture = new TestFixture();
		const count = fixture
			.with_lint_request(
				new LintRunConfiguration(new SourceText(), new NodeFileIO()),
				{
					"direct.ts": [
						"export class Contract { run(): void {} }",
						"function create(): Contract { return { run() {} }; }",
					].join("\n"),
					"alias.ts": [
						"export class Contract { run(): void {} }",
						"type Candidate = Contract;",
						"function create(): Candidate { return { run() {} }; }",
					].join("\n"),
					"assertion.ts": [
						"export class Contract { run(): void {} }",
						"function create(): Contract {",
						"  return (({ run() {} } as Contract)! as Contract);",
						"}",
					].join("\n"),
				},
				(production_lint_configuration, options, mode) =>
					production_lint_configuration.lint_report(options, mode).report.violations,
			)
			.filter((item) => item.rule_id === "typescript-fake-object").length;
		expect(count).toBe(3);
	});

	test("resolves nested namespace contracts when checking callable object returns", () => {
		const fixture = new TestFixture();
		const count = fixture
			.with_lint_request(
				new LintRunConfiguration(new SourceText(), new NodeFileIO()),
				{
					"namespace.ts": [
						"export class Contract { run(): void {} }",
						"namespace Local {",
						"  export type Candidate = Contract;",
						"}",
						"function create(): Local.Candidate { return { run() {} }; }",
					].join("\n"),
					"nested-namespace.ts": [
						"export class Contract { run(): void {} }",
						"namespace Local {",
						"  export namespace Nested {",
						"    export type Candidate = Contract;",
						"  }",
						"}",
						"function create(): Local.Nested.Candidate { return { run() {} }; }",
					].join("\n"),
				},
				(production_lint_configuration, options, mode) =>
					production_lint_configuration.lint_report(options, mode).report.violations,
			)
			.filter((item) => item.rule_id === "typescript-fake-object").length;
		expect(count).toBe(2);
	});
});
