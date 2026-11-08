import { describe, expect, test } from "@jest/globals";
import { LintRunConfiguration } from "src/core/lint_run_configuration";
import { NodeFileIO } from "src/io/node_file_io";
import { SourceText } from "src/io/source_text";
import { TestFixture } from "tests/core/test-fixture";

describe("coding-lint type boundary union edge cases", () => {
	test("allows literal aliases, primitive unions, and a single literal", () => {
		const fixture = new TestFixture();
		const violations = fixture.with_lint_request(
			new LintRunConfiguration(new SourceText(), new NodeFileIO(process.cwd())),
			{
				"literal-unions.ts": ["type First = 'first' | 'second';", "type Second = First | 'third';"].join("\n"),
				"primitive-boundary.ts": "function load(value: string | number): string { return String(value); }",
				"single-literal.ts": "type Status = 'ready';",
			},
			(production_lint_configuration, options, mode) =>
				production_lint_configuration.lint_report(options, mode).report.violations,
		);
		expect({
			literal_aliases: violations
				.filter(
					(item) =>
						item.file() === "literal-unions.ts" &&
						["composite-state-type", "nullable-domain-type", "typescript-union-contract-bypass"].includes(
							item.rule_id(),
						),
				)
				.map((item) => `${item.rule_id()}@${item.file()}:${item.line()}`),
			primitive_union: violations
				.filter(
					(item) =>
						item.file() === "primitive-boundary.ts" &&
						["composite-state-type", "nullable-domain-type"].includes(item.rule_id()),
				)
				.map((item) => `${item.rule_id()}@${item.file()}:${item.line()}`),
			single_literal: violations
				.filter((item) => item.file() === "single-literal.ts" && item.rule_id() === "composite-state-type")
				.map((item) => `${item.rule_id()}@${item.file()}:${item.line()}`),
		}).toEqual({ literal_aliases: [], primitive_union: [], single_literal: [] });
	});

	test("reports nullable and composite intersections at exact type boundaries", () => {
		const fixture = new TestFixture();
		const violations = fixture.with_lint_request(
			new LintRunConfiguration(new SourceText(), new NodeFileIO(process.cwd())),
			{
				"parenthesized-nullable.ts":
					"function load_optional(value: (string | undefined)): string { return String(value); }",
				"intersection-boundary.ts": [
					"function load_composite(",
					"  value: A & B,",
					"): A & B {",
					"  return value;",
					"}",
				].join("\n"),
				"types.ts": [
					"type UserId = { id: string };",
					"type UserName = { name: string };",
					"type Combined = UserId & UserName;",
					"type Explicit = { id: string; name: string };",
				].join("\n"),
				"types.py": [
					"from typing import Protocol",
					"class UserId: pass",
					"class UserName: pass",
					"Combined = UserId & UserName",
					"class ExplicitContract(Protocol):",
					"    id: str",
					"    name: str",
				].join("\n"),
			},
			(production_lint_configuration, options, mode) =>
				production_lint_configuration.lint_report(options, mode).report.violations,
		);
		const boundary_violations = violations
			.filter((item) => ["composite-state-type", "nullable-domain-type"].includes(item.rule_id()))
			.map((item) => `${item.rule_id()}@${item.file()}:${item.line()}`)
			.sort();

		expect(boundary_violations).toEqual([
			"composite-state-type@intersection-boundary.ts:2",
			"composite-state-type@intersection-boundary.ts:3",
			"composite-state-type@types.py:4",
			"composite-state-type@types.ts:3",
			"nullable-domain-type@parenthesized-nullable.ts:1",
		]);
	});
});
