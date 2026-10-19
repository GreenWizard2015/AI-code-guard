import { describe, expect, test } from "@jest/globals";
import { LintRunConfiguration } from "src/core/lint_run_configuration";
import { SourceText } from "src/source_text";
import { NodeFileIO } from "src/io/node_file_io";
import { TestFixture } from "tests/core/test-fixture";

describe("generic TypeScript type boundaries", () => {
	test("rejects composite unions nested in generic parameters", () => {
		const fixture = new TestFixture();
		const violations = fixture.with_lint_request(
			new LintRunConfiguration(new SourceText(), new NodeFileIO()),
			{
				"generic-parameter.ts": [
					'type ControlA = { state: "a" };',
					'type ControlB = { state: "b" };',
					"function read(value: Promise<ControlA | ControlB>): void {}",
				].join("\n"),
			},
			(production_lint_configuration, options, mode) =>
				production_lint_configuration.lint_report(options, mode).report.violations,
		);

		expect(violations.filter((item) => item.rule_id === "composite-state-type")).toHaveLength(1);
	});

	test("rejects composite unions nested in generic properties", () => {
		const fixture = new TestFixture();
		const violations = fixture.with_lint_request(
			new LintRunConfiguration(new SourceText(), new NodeFileIO()),
			{
				"generic-property.ts": [
					'type ControlA = { state: "a" };',
					'type ControlB = { state: "b" };',
					"interface State { value: Array<ControlA | ControlB>; }",
				].join("\n"),
			},
			(production_lint_configuration, options, mode) =>
				production_lint_configuration.lint_report(options, mode).report.violations,
		);

		expect(violations.filter((item) => item.rule_id === "composite-state-type")).toHaveLength(1);
	});

	test("allows primitive unions nested in generic parameters", () => {
		const fixture = new TestFixture();
		const violations = fixture.with_lint_request(
			new LintRunConfiguration(new SourceText(), new NodeFileIO()),
			{
				"generic-primitive.ts": "function read(value: Promise<string | number>): void {}",
			},
			(production_lint_configuration, options, mode) =>
				production_lint_configuration.lint_report(options, mode).report.violations,
		);

		expect(violations.filter((item) => item.rule_id === "composite-state-type")).toHaveLength(0);
	});
});
