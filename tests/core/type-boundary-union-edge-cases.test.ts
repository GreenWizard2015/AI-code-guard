import { describe, expect, test } from "@jest/globals";
import { LintRunConfiguration } from "src/core/lint_run_configuration";
import { SourceText } from "src/source_text";
import { NodeFileIO } from "src/io/node_file_io";
import { TestFixture } from "tests/core/test-fixture";

describe("coding-lint type boundary union edge cases", () => {
	test("allows literal union aliases", () => {
		const fixture = new TestFixture();
		const violations = fixture.with_lint_request(
			new LintRunConfiguration(new SourceText(), new NodeFileIO()),
			{
				"kinds.ts": ["type First = 'first' | 'second';", "type Second = First | 'third';"].join("\n"),
			},
			(production_lint_configuration, options, mode) =>
				production_lint_configuration.lint_report(options, mode).report.violations,
		);
		expect({
			composite: violations.filter((item) => item.rule_id === "composite-state-type"),
			nullable: violations.filter((item) => item.rule_id === "nullable-domain-type"),
			bypass: violations.filter((item) => item.rule_id === "typescript-union-contract-bypass"),
		}).toEqual({ composite: [], nullable: [], bypass: [] });
	});

	test("allows primitive value unions at method boundaries", () => {
		const fixture = new TestFixture();
		const violations = fixture.with_lint_request(
			new LintRunConfiguration(new SourceText(), new NodeFileIO()),
			{
				"boundary.ts": "function load(value: string | number): string { return String(value); }",
			},
			(production_lint_configuration, options, mode) =>
				production_lint_configuration.lint_report(options, mode).report.violations,
		);
		expect({
			composite: violations.filter((item) => item.rule_id === "composite-state-type"),
			nullable: violations.filter((item) => item.rule_id === "nullable-domain-type"),
		}).toEqual({ composite: [], nullable: [] });
	});

	test("rejects parenthesized nullable unions at method boundaries", () => {
		const fixture = new TestFixture();
		const violations = fixture.with_lint_request(
			new LintRunConfiguration(new SourceText(), new NodeFileIO()),
			{
				"parenthesized-nullable.ts": "function load(value: (string | undefined)): string { return String(value); }",
			},
			(production_lint_configuration, options, mode) =>
				production_lint_configuration.lint_report(options, mode).report.violations,
		);
		expect(violations.filter((item) => item.rule_id === "nullable-domain-type")).toHaveLength(1);
	});

	test("keeps composite intersections visible at type boundaries", () => {
		const fixture = new TestFixture();
		const violations = fixture.with_lint_request(
			new LintRunConfiguration(new SourceText(), new NodeFileIO()),
			{
				"boundary.ts": "function load(value: A & B): A & B { return value; }",
			},
			(production_lint_configuration, options, mode) =>
				production_lint_configuration.lint_report(options, mode).report.violations,
		);
		expect(violations.filter((item) => item.rule_id === "composite-state-type")).toEqual([
			expect.objectContaining({ rule_id: "composite-state-type", priority: 6 }),
			expect.objectContaining({ rule_id: "composite-state-type", priority: 6 }),
		]);
	});

	test("does not treat a single literal as a composite union", () => {
		const fixture = new TestFixture();
		const violations = fixture.with_lint_request(
			new LintRunConfiguration(new SourceText(), new NodeFileIO()),
			{
				"single.ts": "type Status = 'ready';",
			},
			(production_lint_configuration, options, mode) =>
				production_lint_configuration.lint_report(options, mode).report.violations,
		);
		expect(violations.filter((item) => item.rule_id === "composite-state-type")).toHaveLength(0);
	});
});
