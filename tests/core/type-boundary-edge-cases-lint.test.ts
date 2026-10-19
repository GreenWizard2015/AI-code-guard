import { describe, expect, test } from "@jest/globals";
import { LintRunConfiguration } from "src/core/lint_run_configuration";
import { SourceText } from "src/source_text";
import { NodeFileIO } from "src/io/node_file_io";
import { TestFixture } from "tests/core/test-fixture";

describe("coding-lint type boundary edge cases", () => {
	test("rejects optional parameters in protocol methods and implementations", () => {
		const fixture = new TestFixture();
		const violations = fixture.with_lint_request(
			new LintRunConfiguration(new SourceText(), new NodeFileIO()),
			{
				"protocol.ts": [
					"interface PollingCancellation {",
					'  addEventListener(type: "abort", listener: EventListener, options?: AddEventListenerOptions): void;',
					"}",
					"class NoPollingCancellation implements PollingCancellation {",
					'  addEventListener(_type: "abort", _listener: EventListener, _options?: AddEventListenerOptions): void {}',
					"}",
				].join("\n"),
			},
			(production_lint_configuration, options, mode) =>
				production_lint_configuration.lint_report(options, mode).report.violations,
		);
		expect(violations.filter((item) => item.rule_id === "nullable-domain-type")).toHaveLength(2);
	});

	test("rejects optional parameters in implemented rule methods", () => {
		const fixture = new TestFixture();
		const violations = fixture.with_lint_request(
			new LintRunConfiguration(new SourceText(), new NodeFileIO()),
			{
				"diagnostic-rule.ts": [
					"interface RuleContract {",
					"  violation(file: string, line: number, parameters?: RuleParameters): ViolationContract;",
					"}",
					"class DiagnosticRule implements RuleContract {",
					"  public violation(file: string, line: number, parameters?: RuleParameters): ViolationContract {",
					"    return {} as ViolationContract;",
					"  }",
					"}",
				].join("\n"),
			},
			(production_lint_configuration, options, mode) =>
				production_lint_configuration.lint_report(options, mode).report.violations,
		);

		expect(violations.filter((item) => item.rule_id === "nullable-domain-type")).toHaveLength(2);
	});

	test("keeps optional parameters outside contracts visible", () => {
		const fixture = new TestFixture();
		const violations = fixture.with_lint_request(
			new LintRunConfiguration(new SourceText(), new NodeFileIO()),
			{
				"domain.ts": "function load(options?: AddEventListenerOptions): void {}",
			},
			(production_lint_configuration, options, mode) =>
				production_lint_configuration.lint_report(options, mode).report.violations,
		);
		expect(violations.filter((item) => item.rule_id === "nullable-domain-type")).toHaveLength(1);
	});

	test("rejects any unions in rest parameters", () => {
		const fixture = new TestFixture();
		const violations = fixture.with_lint_request(
			new LintRunConfiguration(new SourceText(), new NodeFileIO()),
			{
				"rest-union.ts": [
					"type Context = { value: string };",
					"function collect(...provided: readonly (Context | readonly string[] | undefined)[]): void {}",
					"function collect_arrays(...provided: (Context[] | string[])[]): void {}",
					'type ParseMode = "json" | "text";',
					"function collect_named_union(...modes: ParseMode): void {}",
					"function collect_named(...values: readonly string[]): void {}",
				].join("\n"),
			},
			(production_lint_configuration, options, mode) =>
				production_lint_configuration.lint_report(options, mode).report.violations,
		);
		expect(violations.filter((item) => item.rule_id === "typescript-rest-union-contract")).toHaveLength(3);
	});

	test("rejects a zero-index value followed by an undefined guard", () => {
		const fixture = new TestFixture();
		const violations = fixture.with_lint_request(
			new LintRunConfiguration(new SourceText(), new NodeFileIO()),
			{
				"array-guard.ts": [
					"function read(...parameter_values: readonly string[]): string {",
					"  const parameters = parameter_values[0];",
					"  if (parameters !== undefined) { return parameters; }",
					'  return "";',
					"}",
					"function read_missing(...parameter_values: readonly string[]): string {",
					"  const parameter = parameter_values[0];",
					'  if (parameter === undefined) { return ""; }',
					"  return parameter;",
					"}",
				].join("\n"),
			},
			(production_lint_configuration, options, mode) =>
				production_lint_configuration.lint_report(options, mode).report.violations,
		);

		expect(violations.filter((item) => item.rule_id === "single-item-array-state")).toHaveLength(2);
	});

	test("rejects parenthesized zero-index guards", () => {
		const fixture = new TestFixture();
		const violations = fixture.with_lint_request(
			new LintRunConfiguration(new SourceText(), new NodeFileIO()),
			{
				"array-guard-parenthesized.ts": [
					"function read(...parameter_values: readonly string[]): string {",
					"  const parameters = parameter_values[0];",
					"  if ((parameters !== undefined)) { return parameters; }",
					'  return "";',
					"}",
				].join("\n"),
			},
			(production_lint_configuration, options, mode) =>
				production_lint_configuration.lint_report(options, mode).report.violations,
		);

		expect(violations.filter((item) => item.rule_id === "single-item-array-state")).toHaveLength(1);
	});

	test("rejects parenthesized zero-index initializers", () => {
		const fixture = new TestFixture();
		const violations = fixture.with_lint_request(
			new LintRunConfiguration(new SourceText(), new NodeFileIO()),
			{
				"array-initializer-parenthesized.ts": [
					"function read(...parameter_values: readonly string[]): string {",
					"  const parameters = (parameter_values[0]);",
					"  if (parameters !== undefined) { return parameters; }",
					'  return "";',
					"}",
					"function read_arithmetic_zero(...parameter_values: readonly string[]): string {",
					"  const parameters = parameter_values[1 - 1];",
					"  if (parameters !== undefined) { return parameters; }",
					'  return "";',
					"}",
					"function read_satisfies_assertion(...parameter_values: readonly string[]): string {",
					"  const parameters = parameter_values[0] satisfies string;",
					"  if (parameters !== undefined) { return parameters; }",
					'  return "";',
					"}",
				].join("\n"),
			},
			(production_lint_configuration, options, mode) =>
				production_lint_configuration.lint_report(options, mode).report.violations,
		);

		expect(violations.filter((item) => item.rule_id === "single-item-array-state")).toHaveLength(3);
	});

	test("rejects normalized zero-index arguments", () => {
		const fixture = new TestFixture();
		const violations = fixture.with_lint_request(
			new LintRunConfiguration(new SourceText(), new NodeFileIO()),
			{
				"array-index-parenthesized.ts": [
					"function read(...parameter_values: readonly string[]): string {",
					"  const parameters = parameter_values[(0)];",
					"  if (parameters !== undefined) { return parameters; }",
					'  return "";',
					"}",
					"function read_plus_zero(...parameter_values: readonly string[]): string {",
					"  const parameters = parameter_values[+0];",
					"  if (parameters !== undefined) { return parameters; }",
					'  return "";',
					"}",
				].join("\n"),
			},
			(production_lint_configuration, options, mode) =>
				production_lint_configuration.lint_report(options, mode).report.violations,
		);

		expect(violations.filter((item) => item.rule_id === "single-item-array-state")).toHaveLength(2);
	});

	test("rejects normalized zero-index assertions", () => {
		const fixture = new TestFixture();
		const violations = fixture.with_lint_request(
			new LintRunConfiguration(new SourceText(), new NodeFileIO()),
			{
				"array-index-nonnull.ts": [
					"function read(...parameter_values: readonly string[]): string {",
					"  const parameters = parameter_values[0]!;",
					"  if (parameters !== undefined) { return parameters; }",
					'  return "";',
					"}",
					"function read_as_assertion(...parameter_values: readonly string[]): string {",
					"  const parameters = parameter_values[0] as string;",
					"  if (parameters !== undefined) { return parameters; }",
					'  return "";',
					"}",
				].join("\n"),
			},
			(production_lint_configuration, options, mode) =>
				production_lint_configuration.lint_report(options, mode).report.violations,
		);

		expect(violations.filter((item) => item.rule_id === "single-item-array-state")).toHaveLength(2);
	});

	test("rejects explicit TypeScript type assertions but allows const inference", () => {
		const fixture = new TestFixture();
		const violations = fixture.with_lint_request(
			new LintRunConfiguration(new SourceText(), new NodeFileIO()),
			{
				"assertions.ts": [
					"const first = value as string;",
					"const second = <string>value;",
					"const literal = value as const;",
				].join("\n"),
			},
			(production_lint_configuration, options, mode) =>
				production_lint_configuration.lint_report(options, mode).report.violations,
		);

		expect(violations.filter((item) => item.rule_id === "typescript-type-assertion")).toHaveLength(2);
	});
});
