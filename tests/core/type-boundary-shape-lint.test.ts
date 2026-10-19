import { describe, expect, test } from "@jest/globals";
import { LintRunConfiguration } from "src/core/lint_run_configuration";
import { SourceText } from "src/source_text";
import { NodeFileIO } from "src/io/node_file_io";
import { TestFixture } from "tests/core/test-fixture";
import "src/rules/typescript/syntax-rules/types/rest_union_contract_rule";
import "src/rules/typescript/syntax-rules/runtime/type_script_basic_rules";

describe("coding-lint duplicate type shapes", () => {
	test("reports TypeScript declarations with the same sorted field shape", () => {
		const test_fixture = new TestFixture();
		const violations = test_fixture.with_lint_request(
			new LintRunConfiguration(new SourceText(), new NodeFileIO()),
			{
				"duplicate-types.ts": [
					"type JsonResponse = { content: Record<string, unknown>; };",
					"type TextResponse = { content: Record<string, unknown>; };",
					"type ReorderedResponse = { value: string; content: Record<string, unknown>; };",
					"type DifferentResponse = { content: string; };",
				].join("\n"),
			},
			(production_lint_configuration, options, mode) =>
				production_lint_configuration.lint_report(options, mode).report.violations,
		);
		expect(violations).toContainEqual(
			expect.objectContaining({
				rule_id: "duplicate-type-shape",
				message: "duplicate type shape: JsonResponse, TextResponse",
			}),
		);
	});

	test("reports Python classes with the same field shape", () => {
		const test_fixture = new TestFixture();
		const violations = test_fixture.with_lint_request(
			new LintRunConfiguration(new SourceText(), new NodeFileIO()),
			{
				"duplicate-types.py": [
					"from dataclasses import dataclass",
					"@dataclass",
					"class CompletionContext:",
					"    tab_id: str",
					"    call_id: str",
					"    result: str",
					"    error: str",
					"@dataclass",
					"class CompletionErrorContext:",
					"    error: str",
					"    result: str",
					"    call_id: str",
					"    tab_id: str",
				].join("\n"),
			},
			(production_lint_configuration, options, mode) =>
				production_lint_configuration.lint_report(options, mode).report.violations,
		);
		expect(violations).toContainEqual(
			expect.objectContaining({
				rule_id: "duplicate-type-shape",
				message: "duplicate type shape: CompletionContext, CompletionErrorContext",
			}),
		);
	});

	test("keeps Python wrappers with different native bases distinct", () => {
		const test_fixture = new TestFixture();
		const violations = test_fixture.with_lint_request(
			new LintRunConfiguration(new SourceText(), new NodeFileIO()),
			{
				"json-value-states.py": [
					"class JsonObjectState(dict):",
					"    present: bool",
					"class JsonStringState(str):",
					"    present: bool",
					"class JsonListState(list):",
					"    present: bool",
				].join("\n"),
			},
			(production_lint_configuration, options, mode) =>
				production_lint_configuration.lint_report(options, mode).report.violations,
		);
		expect(violations.filter((item) => item.rule_id === "duplicate-type-shape")).toHaveLength(0);
	});

	test("keeps TypeScript declarations with different native bases distinct", () => {
		const test_fixture = new TestFixture();
		const violations = test_fixture.with_lint_request(
			new LintRunConfiguration(new SourceText(), new NodeFileIO()),
			{
				"native-base-types.ts": [
					"interface JsonValue extends Record<string, unknown> {",
					"  present: boolean;",
					"}",
					"interface StringValue extends String {",
					"  present: boolean;",
					"}",
				].join("\n"),
			},
			(production_lint_configuration, options, mode) =>
				production_lint_configuration.lint_report(options, mode).report.violations,
		);
		expect(violations.filter((item) => item.rule_id === "duplicate-type-shape")).toHaveLength(0);
	});
});
