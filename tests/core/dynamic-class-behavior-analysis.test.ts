import { describe, expect, test } from "@jest/globals";
import { LintRunConfiguration } from "src/core/lint_run_configuration";
import { SourceText } from "src/source_text";
import { NodeFileIO } from "src/io/node_file_io";
import { TestFixture } from "tests/core/test-fixture";

describe("dynamic class behavior analysis", () => {
	test("reports dynamic factories, static methods, and dynamic execution", () => {
		const fixture = new TestFixture();
		const violations = fixture.with_lint_request(
			new LintRunConfiguration(new SourceText(), new NodeFileIO()),
			{
				"dynamic-container.ts": [
					"declare const module_name: string;",
					"require(module_name);",
					"declare const enabled: boolean;",
					'void [enabled && console.log("array")];',
					'void { value: enabled && console.log("property") };',
				].join("\n"),
				"dynamic-type.ts": ["const type_alias = type;", "const Model = type_alias('Model', {}, {});"].join("\n"),
				"dynamic-type-alias.py": [
					"import builtins",
					"type_factory = builtins.type",
					'Candidate = type_factory("Candidate", (), {})',
					"destructured_type, ignored = (builtins.type, None)",
					'DestructuredCandidate = destructured_type("DestructuredCandidate", (), {})',
					"builtins_alias = builtins",
					'OtherCandidate = builtins_alias.type("OtherCandidate", (), {})',
				].join("\n"),
				"dynamic-type-map.py": [
					"from builtins import type as type_factory",
					'factories = {"type": type_factory}',
					'dynamic_class = factories["type"]("DynamicClass", (), {})',
				].join("\n"),
				"static-method.py": [
					"class Rate:",
					"    @staticmethod",
					"    def control(value: int) -> int:",
					"        return value * 2",
					"    def candidate(value: int) -> int:",
					"        return value * 2",
					"    candidate = staticmethod(candidate)",
				].join("\n"),
			},
			(production_lint_configuration, options, mode) =>
				production_lint_configuration.lint_report(options, mode).report.violations,
		);
		const messages = violations.map((item) => item.message);
		expect({
			dynamic_class_construction:
				messages.filter((message) => message === "avoid dynamic class construction with type(...)").length > 0,
			static_methods: messages.filter((message) => message === "avoid static methods").length,
			dynamic_imports: messages.includes("avoid dynamic imports"),
			conditional_execution: messages.filter((message) => message === "avoid conditional execution operators").length,
		}).toEqual({
			dynamic_class_construction: true,
			static_methods: 2,
			dynamic_imports: true,
			conditional_execution: 2,
		});
	});

	test("reports prototype mutation, temporary-result access, and repeated branch comparisons", () => {
		const fixture = new TestFixture();
		const violations = fixture.with_lint_request(
			new LintRunConfiguration(new SourceText(), new NodeFileIO()),
			{
				"prototype-key-alias.ts": [
					"class Constructor {}",
					"const prototype_name = 'prototype';",
					"Constructor[prototype_name].run = function run(): void {};",
				].join("\n"),
				"prototype-wrapper.ts": [
					"class Constructor {}",
					"((Constructor.prototype) satisfies object).run = function run(): void {};",
				].join("\n"),
				"prototype-value-alias.ts": [
					"class Constructor {}",
					"const PROTOTYPE = Constructor.prototype;",
					"PROTOTYPE.run = function run(): void {};",
					"PROTOTYPE.reset = function reset(): void {};",
				].join("\n"),
				"temporary-result.ts": "(new Date() as Date).toISOString();",
				"prototype-mutation.ts": [
					"class Base { public run(): void { return; } }",
					"class Candidate {}",
					"Object.setPrototypeOf(Candidate.prototype, Base.prototype);",
				].join("\n"),
				"branches.ts": [
					"function render(kind: string) {",
					'  if (kind === "A") return "a";',
					'  else if (kind === "B") return "b";',
					'  return "other";',
					"}",
				].join("\n"),
				"branches.py": [
					"def render(kind):",
					'    if kind == "A":',
					'        return "a"',
					'    elif kind == "B":',
					'        return "b"',
					'    return "other"',
				].join("\n"),
			},
			(production_lint_configuration, options, mode) =>
				production_lint_configuration.lint_report(options, mode).report.violations,
		);
		expect({
			prototype_assignments: violations.filter((item) => item.rule_id === "typescript-prototype-assignment").length,
			temporary_result_access: violations.filter((item) => item.rule_id === "temporary-result-access").length,
			repeated_branch_comparisons: violations.filter(
				(item) => item.message === "repeated comparisons of one variable should use a lookup map",
			).length,
		}).toEqual({ prototype_assignments: 5, temporary_result_access: 1, repeated_branch_comparisons: 2 });
	});
});
