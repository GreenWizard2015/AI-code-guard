import { describe, expect, test } from "@jest/globals";
import { LintRunConfiguration } from "src/core/lint_run_configuration";
import { NodeFileIO } from "src/io/node_file_io";
import { SourceText } from "src/io/source_text";
import { TestFixture } from "tests/core/test-fixture";

describe("coding-lint type boundary edge cases", () => {
	test("rejects optional parameters at protocol, implementation, and function boundaries", () => {
		const fixture = new TestFixture();
		const violations = fixture.with_lint_request(
			new LintRunConfiguration(new SourceText(), new NodeFileIO(process.cwd())),
			{
				"protocol.ts": [
					"interface PollingCancellation {",
					'  addEventListener(type: "abort", listener: EventListener, options?: AddEventListenerOptions): void;',
					"}",
					"class NoPollingCancellation implements PollingCancellation {",
					'  addEventListener(_type: "abort", _listener: EventListener, _options?: AddEventListenerOptions): void {}',
					"}",
				].join("\n"),
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
				"domain.ts": "function load(options?: AddEventListenerOptions): void {}",
			},
			(production_lint_configuration, options, mode) =>
				production_lint_configuration.lint_report(options, mode).report.violations,
		);
		const optional_parameters = violations.filter((item) => item.rule_id() === "nullable-domain-type");

		expect({
			protocol: optional_parameters
				.filter((item) => item.file() === "protocol.ts")
				.map((item) => `${item.file()}:${item.line()}`),
			diagnostic_rule: optional_parameters
				.filter((item) => item.file() === "diagnostic-rule.ts")
				.map((item) => `${item.file()}:${item.line()}`),
			function_boundary: optional_parameters
				.filter((item) => item.file() === "domain.ts")
				.map((item) => `${item.file()}:${item.line()}`),
		}).toEqual({
			protocol: ["protocol.ts:2", "protocol.ts:5"],
			diagnostic_rule: ["diagnostic-rule.ts:2", "diagnostic-rule.ts:5"],
			function_boundary: ["domain.ts:1"],
		});
	});

	test("detects rest unions at callable boundaries", () => {
		const fixture = new TestFixture();
		const violations = fixture.with_lint_request(
			new LintRunConfiguration(new SourceText(), new NodeFileIO(process.cwd())),
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
		const rest_unions = violations.filter((item) => item.rule_id() === "typescript-rest-union-contract");

		expect(rest_unions.map((item) => `${item.file()}:${item.line()}`)).toEqual([
			"rest-union.ts:2",
			"rest-union.ts:3",
			"rest-union.ts:5",
		]);
	});

	test("rejects explicit type assertions while allowing const inference", () => {
		const fixture = new TestFixture();
		const violations = fixture.with_lint_request(
			new LintRunConfiguration(new SourceText(), new NodeFileIO(process.cwd())),
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
		const type_assertions = violations.filter((item) => item.rule_id() === "typescript-type-assertion");

		expect(type_assertions.map((item) => `${item.file()}:${item.line()}`)).toEqual([
			"assertions.ts:1",
			"assertions.ts:2",
		]);
	});

	test("detects zero-index guards through direct and parenthesized expressions", () => {
		const fixture = new TestFixture();
		const violations = fixture.with_lint_request(
			new LintRunConfiguration(new SourceText(), new NodeFileIO(process.cwd())),
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
				"array-guard-parenthesized.ts": [
					"function read(...parameter_values: readonly string[]): string {",
					"  const parameters = parameter_values[0];",
					"  if ((parameters !== undefined)) { return parameters; }",
					'  return "";',
					"}",
				].join("\n"),
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
		const zero_index_issues = violations.filter((item) => item.rule_id() === "single-item-array-state");

		expect({
			direct_guards: zero_index_issues
				.filter((item) => item.file() === "array-guard.ts")
				.map((item) => `${item.file()}:${item.line()}`),
			parenthesized_guard: zero_index_issues
				.filter((item) => item.file() === "array-guard-parenthesized.ts")
				.map((item) => `${item.file()}:${item.line()}`),
			parenthesized_initializer: zero_index_issues
				.filter((item) => item.file() === "array-initializer-parenthesized.ts")
				.map((item) => `${item.file()}:${item.line()}`),
		}).toEqual({
			direct_guards: ["array-guard.ts:3", "array-guard.ts:8"],
			parenthesized_guard: ["array-guard-parenthesized.ts:3"],
			parenthesized_initializer: [
				"array-initializer-parenthesized.ts:3",
				"array-initializer-parenthesized.ts:8",
				"array-initializer-parenthesized.ts:13",
			],
		});
	});

	test("detects normalized zero indexes and asserted values", () => {
		const fixture = new TestFixture();
		const violations = fixture.with_lint_request(
			new LintRunConfiguration(new SourceText(), new NodeFileIO(process.cwd())),
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
		const zero_index_issues = violations.filter((item) => item.rule_id() === "single-item-array-state");

		expect({
			parenthesized_index: zero_index_issues
				.filter((item) => item.file() === "array-index-parenthesized.ts")
				.map((item) => `${item.file()}:${item.line()}`),
			asserted_values: zero_index_issues
				.filter((item) => item.file() === "array-index-nonnull.ts")
				.map((item) => `${item.file()}:${item.line()}`),
		}).toEqual({
			parenthesized_index: ["array-index-parenthesized.ts:3", "array-index-parenthesized.ts:8"],
			asserted_values: ["array-index-nonnull.ts:3", "array-index-nonnull.ts:8"],
		});
	});
});
