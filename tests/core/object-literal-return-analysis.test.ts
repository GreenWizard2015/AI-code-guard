import { describe, expect, test } from "@jest/globals";
import { LintRunConfiguration } from "src/core/lint_run_configuration";
import { NodeFileIO } from "src/io/node_file_io";
import { SourceText } from "src/io/source_text";
import { TestFixture } from "tests/core/test-fixture";

describe("object-literal return analysis", () => {
	test("allows data-only object returns and reports callable behavioral returns", () => {
		const fixture = new TestFixture();
		const violations = fixture.with_lint_request(
			new LintRunConfiguration(new SourceText(), new NodeFileIO(process.cwd())),
			{
				"project-names.ts": [
					"export type ProjectNames = {",
					"  readonly project_class_names: ReadonlySet<string>;",
					"  readonly project_alias_names: ReadonlySet<string>;",
					"};",
					"export function project_names(): ProjectNames {",
					"  const names = new Set<string>();",
					"  return { project_class_names: names, project_alias_names: names };",
					"}",
				].join("\n"),
				"behavior.ts": [
					"export interface ProjectBehavior { run(): void; }",
					"export function create_behavior(): ProjectBehavior { return { run() {} }; }",
				].join("\n"),
			},
			(production_lint_configuration, options, mode) =>
				production_lint_configuration.lint_report(options, mode).report.violations,
		);
		const object_return_violations = violations.filter(
			(violation) => violation.rule_id() === "typescript-object-literal-return",
		);

		expect(object_return_violations.filter((violation) => violation.file().endsWith("project-names.ts"))).toHaveLength(
			0,
		);
		expect(object_return_violations.filter((violation) => violation.file().endsWith("behavior.ts"))).toHaveLength(1);
	});

	test("detects callable object returns through direct and wrapped contract types", () => {
		const fixture = new TestFixture();
		const count = fixture
			.with_lint_request(
				new LintRunConfiguration(new SourceText(), new NodeFileIO(process.cwd())),
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
			.filter((item) => item.rule_id() === "typescript-fake-object").length;
		expect(count).toBe(3);
	});

	test("resolves nested namespace contracts when checking callable object returns", () => {
		const fixture = new TestFixture();
		const count = fixture
			.with_lint_request(
				new LintRunConfiguration(new SourceText(), new NodeFileIO(process.cwd())),
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
			.filter((item) => item.rule_id() === "typescript-fake-object").length;
		expect(count).toBe(2);
	});
});
