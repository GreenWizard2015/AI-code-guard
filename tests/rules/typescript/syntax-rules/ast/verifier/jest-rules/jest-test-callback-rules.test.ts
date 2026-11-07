import { describe, expect, test } from "@jest/globals";
import type { ViolationContract } from "src/reporting_protocols";
import { JestBindingIndex } from "src/rules/typescript/syntax-rules/ast/verifier/jest-rules/jest_binding_index";
import { JestTestRules } from "src/rules/typescript/syntax-rules/ast/verifier/jest-rules/jest_test_rules";
import { TestModuleResolver } from "tests/rules/typescript/syntax-rules/test-module-resolver";
import ts from "typescript";

describe("AST-detectable implementation hacks", () => {
	test("requires Jest tests to end with expect", () => {
		const source_file = ts.createSourceFile(
			"tests/jest-test-ending.test.ts",
			[
				"describe('test ending', () => {",
				"  test('bad order', () => {",
				"    expect(true).toBe(true);",
				"    const trailing_value = true;",
				"    expect(trailing_value).toBe(true);",
				"  });",
				"  test('good order', () => {",
				"    const value = true;",
				"    expect(value).toBe(true);",
				"  });",
				"});",
			].join("\n"),
			ts.ScriptTarget.Latest,
			true,
			ts.ScriptKind.TS,
		);
		const violations: ViolationContract[] = [];
		const rules = new JestTestRules(source_file.fileName, source_file, new JestBindingIndex(source_file));
		rules.append_violations(violations, new TestModuleResolver());

		expect(violations.filter((violation) => violation.rule_id() === "typescript-jest-test-ending")).toHaveLength(1);
	});

	test("requires Jest tests to use arrow callbacks and contain expect", () => {
		const source_file = ts.createSourceFile(
			"tests/jest-test-shape.test.ts",
			[
				"describe('test shape', () => {",
				"  test('function callback', function named_callback() { expect(true).toBe(true); });",
				"  test('missing assertion', () => { const value = true; void value; });",
				"});",
			].join("\n"),
			ts.ScriptTarget.Latest,
			true,
			ts.ScriptKind.TS,
		);
		const violations: ViolationContract[] = [];
		const rules = new JestTestRules(source_file.fileName, source_file, new JestBindingIndex(source_file));
		rules.append_violations(violations, new TestModuleResolver());

		expect({
			lambda: violations.filter((violation) => violation.rule_id() === "typescript-jest-test-lambda").length,
			expect: violations.filter((violation) => violation.rule_id() === "typescript-jest-test-expect").length,
		}).toEqual({ lambda: 1, expect: 1 });
	});

	test("classifies Jest callbacks before optional timeout arguments", () => {
		const source_file = ts.createSourceFile(
			"tests/jest-test-timeout-callback.test.ts",
			[
				"describe('timeout callbacks', () => {",
				"  test('arrow callback', () => { expect(true).toBe(true); }, 1000);",
				"  test('function expression', function named_callback() { expect(true).toBe(true); }, 1000);",
				"});",
			].join("\n"),
			ts.ScriptTarget.Latest,
			true,
			ts.ScriptKind.TS,
		);
		const violations: ViolationContract[] = [];
		const rules = new JestTestRules(source_file.fileName, source_file, new JestBindingIndex(source_file));
		rules.append_violations(violations, new TestModuleResolver());
		const lambda_lines = violations
			.filter((violation) => violation.rule_id() === "typescript-jest-test-lambda")
			.map((violation) => violation.line());
		expect(lambda_lines).toEqual([3]);
	});

	test("checks timeout-bearing callbacks for arrow, direct expect, and ending rules", () => {
		const source_file = ts.createSourceFile(
			"tests/jest-test-timeout-ending.test.ts",
			[
				"describe('timeout callbacks', () => {",
				"  test('arrow callback', () => { expect(true).toBe(true); }, 1000);",
				"  test('function expression', function named_callback() { expect(true).toBe(true); }, 1000);",
				"});",
			].join("\n"),
			ts.ScriptTarget.Latest,
			true,
			ts.ScriptKind.TS,
		);
		const violations: ViolationContract[] = [];
		const rules = new JestTestRules(source_file.fileName, source_file, new JestBindingIndex(source_file));
		rules.append_violations(violations, new TestModuleResolver());
		expect({
			lambda: violations
				.filter((violation) => violation.rule_id() === "typescript-jest-test-lambda")
				.map((violation) => violation.line()),
			direct_expect: violations.filter((violation) => violation.rule_id() === "typescript-jest-test-expect").length,
			ending: violations.filter((violation) => violation.rule_id() === "typescript-jest-test-ending").length,
		}).toEqual({ lambda: [3], direct_expect: 0, ending: 0 });
	});
});
