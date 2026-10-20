import { describe, expect, test } from "@jest/globals";
import { LintRunConfiguration } from "src/core/lint_run_configuration";
import { SourceText } from "src/source_text";
import { NodeFileIO } from "src/io/node_file_io";
import { PYTHON_COMPOSITION_FILES } from "tests/core/constants/ast_analysis/constants";
import { TestFixture } from "tests/core/test-fixture";

describe("coding-lint shared metrics - grouped type boundaries", () => {
	test("rejects generic class field types", () => {
		const fixture = new TestFixture();
		const violations = fixture.with_lint_request(
			new LintRunConfiguration(new SourceText(), new NodeFileIO()),
			{
				"generic-fields.ts": [
					"class GenericFields {",
					"  any_value: any;",
					"  object_value: object;",
					"  unknown_value: unknown;",
					"}",
				].join("\n"),
			},
			(production_lint_configuration, options, mode) =>
				production_lint_configuration.lint_report(options, mode).report.violations,
		);
		const generic_fields = violations.filter(
			(item) => item.message.includes("field") && item.message.includes("instead"),
		);
		expect(generic_fields.map((item) => item.priority)).toEqual([5, 5, 5]);
		expect(generic_fields.map((item) => item.rule_id)).toEqual(["type-warning", "type-warning", "type-warning"]);
	});

	test("does not ignore project-owned boundary types", () => {
		const fixture = new TestFixture();
		const violations = fixture.with_lint_request(
			new LintRunConfiguration(new SourceText(), new NodeFileIO()),
			{
				"reviewed-boundaries.ts": [
					"function first(request: DispatchRequest) { return request.method + request.path; }",
					"function second(request: DispatchRequest) { return request.method + request.path; }",
					"function third(request: DispatchRequest) { return request.method + request.path; }",
					"function fourth(request: DispatchRequest) { return request.method + request.path; }",
					"function render(message: FacebookMessage) { return message.name + message.text; }",
					"function serialize(message: FacebookMessage) { return message.name + message.text; }",
					"function display(message: FacebookMessage) { return message.name + message.text; }",
					"function format(message: FacebookMessage) { return message.name + message.text; }",
				].join("\n"),
			},
			(production_lint_configuration, options, mode) =>
				production_lint_configuration.lint_report(options, mode).report.violations,
		);
		expect(violations.some((item) => item.message.includes("share parameter type"))).toBe(true);
	});

	test("hints at a wrapper and checking all usages for shared platform types", () => {
		const fixture = new TestFixture();
		const violations = fixture.with_lint_request(
			new LintRunConfiguration(new SourceText(), new NodeFileIO()),
			{
				"platform-wrapper.ts": [
					"type TextAreaElement = { value: string };",
					"class Editor {",
					"  set(input: TextAreaElement) { return input.value + input.value; }",
					"  clear(input: TextAreaElement) { return input.value + input.value; }",
					"  length(input: TextAreaElement) { return input.value + input.value; }",
					"  read(input: TextAreaElement) { return input.value + input.value; }",
					"}",
				].join("\n"),
			},
			(production_lint_configuration, options, mode) =>
				production_lint_configuration.lint_report(options, mode).report.violations,
		);
		const violation = violations.find((item) => item.message.includes("share parameter type"));
		expect(violation?.hint).toContain("every production use");
		expect(violation?.hint).toContain("focused project wrapper");
	});

	test("reports Python class composition through relative imports", () => {
		const fixture = new TestFixture();
		const violations = fixture.with_lint_request(
			new LintRunConfiguration(new SourceText(), new NodeFileIO()),
			PYTHON_COMPOSITION_FILES,
			(production_lint_configuration, options, mode) =>
				production_lint_configuration.lint_report(options, mode).report.violations,
		);
		expect(violations.map((item) => item.message)).toContain(
			"class composition is too deep (found 4 levels): Root -> Middle -> Leaf -> End",
		);
	});
});
