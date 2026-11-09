import { describe, expect, test } from "@jest/globals";
import { LintStageTimer } from "src/lint_stage_timer";
import type { ViolationContract } from "src/reporting_protocols";
import { JestBindingIndex } from "src/rules/typescript/syntax-rules/ast/verifier/jest-rules/jest_binding_index";
import { JestTestRules } from "src/rules/typescript/syntax-rules/ast/verifier/jest-rules/jest_test_rules";
import { TestModuleResolver } from "tests/rules/typescript/syntax-rules/test-module-resolver";
import ts from "typescript";

describe("AST-detectable implementation hacks", () => {
	test("applies callable size limits to individual Jest tests", () => {
		const test_source_lines = [
			"describe('test size', () => {",
			"  test('large test', () => {",
			Array.from({ length: 20 }, (_, index) => `    const value_${index} = ${index};`).join("\n"),
			"  });",
			"  test('small test', () => {});",
			"  test('one assertion', () => { expect(true).toBe(true); });",
			"  test('expression callback', () => expect(true).toBe(true));",
			"  test('minimum boundary', () => { const value = true; expect(value).toBe(true); });",
			"  test('maximum boundary', () => {",
			Array.from({ length: 13 }, (_, index) => `    const boundary_${index} = ${index};`).join("\n"),
			"    expect(boundary_12).toBe(12);",
			"  });",
			"});",
		];
		const test_source = test_source_lines.join("\n");
		const source_file = ts.createSourceFile(
			"tests/jest-test-size.test.ts",
			test_source,
			ts.ScriptTarget.Latest,
			true,
			ts.ScriptKind.TS,
		);
		const violations: ViolationContract[] = [];
		const rules = new JestTestRules(
			source_file.fileName,
			source_file,
			new JestBindingIndex(source_file),
			new LintStageTimer(),
		);
		rules.append_violations(violations, new TestModuleResolver());

		expect(violations.filter((violation) => violation.rule_id() === "test-max-size")).toHaveLength(1);
		expect(violations.filter((violation) => violation.rule_id() === "test-min-size")).toHaveLength(3);
	});

	test("requires one flat top-level Jest describe", () => {
		const source_file = ts.createSourceFile(
			"tests/jest-structure.test.ts",
			[
				"describe('outer', () => {",
				"  describe('nested', () => { test('nested test', () => {}); });",
				"});",
				"describe('second', () => { test('second test', () => {}); });",
			].join("\n"),
			ts.ScriptTarget.Latest,
			true,
			ts.ScriptKind.TS,
		);
		const violations: ViolationContract[] = [];
		const rules = new JestTestRules(
			source_file.fileName,
			source_file,
			new JestBindingIndex(source_file),
			new LintStageTimer(),
		);
		rules.append_violations(violations, new TestModuleResolver());

		expect(violations.map((violation) => violation.rule_id())).toEqual(
			expect.arrayContaining(["typescript-jest-describe-count", "typescript-jest-nested-describe"]),
		);
	});

	test("keeps per-test diagnostics active when suite structure is invalid", () => {
		const test_lines = [
			"describe('first', () => { test('short', () => {}); });",
			"describe('second', () => {",
			"  test('long', () => {",
			...Array.from({ length: 20 }, (_, index) => `    const value_${index} = ${index};`),
			"  });",
			"});",
		];
		const test_text = test_lines.join("\n");
		const source_file = ts.createSourceFile(
			"tests/invalid-jest-structure.test.ts",
			test_text,
			ts.ScriptTarget.Latest,
			true,
			ts.ScriptKind.TS,
		);
		const violations: ViolationContract[] = [];
		const rules = new JestTestRules(
			source_file.fileName,
			source_file,
			new JestBindingIndex(source_file),
			new LintStageTimer(),
		);
		rules.append_violations(violations, new TestModuleResolver());

		expect(violations.filter((violation) => violation.rule_id() === "typescript-jest-describe-count")).toHaveLength(1);
		expect(violations.filter((violation) => violation.rule_id() === "test-max-size")).toHaveLength(1);
	});
});
