import { describe, expect, test } from "@jest/globals";
import { LintStageTimer } from "src/lint_stage_timer";
import type { ViolationContract } from "src/reporting_protocols";
import { JestBindingIndex } from "src/rules/typescript/syntax-rules/ast/verifier/jest-rules/jest_binding_index";
import { JestTestRules } from "src/rules/typescript/syntax-rules/ast/verifier/jest-rules/jest_test_rules";
import { TestModuleResolver } from "tests/rules/typescript/syntax-rules/test-module-resolver";
import ts from "typescript";

/** Responsibilities: _Jest test case suite membership regression cases_. **/
describe("Jest test in describe rule", () => {
	test("reports top-level it, test, and each calls", () => {
		const source_file = ts.createSourceFile(
			"tests/jest-test-in-describe.test.ts",
			[
				'import { expect, it, test } from "@jest/globals";',
				"it('top-level it', () => { expect(true).toBe(true); });",
				"test('top-level test', () => { expect(true).toBe(true); });",
				"it.each([[true]])('top-level each', (value) => { expect(value).toBe(true); });",
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

		expect(
			violations
				.filter((violation) => violation.rule_id() === "typescript-jest-test-in-describe")
				.map((violation) => violation.line()),
		).toEqual([2, 3, 4]);
	});

	test("allows it and test calls, including each, inside describe", () => {
		const source_file = ts.createSourceFile(
			"tests/jest-test-in-describe-valid.test.ts",
			[
				'import { describe, expect, it, test } from "@jest/globals";',
				"describe('suite', () => {",
				"  it('it case', () => { expect(true).toBe(true); });",
				"  test('test case', () => { expect(true).toBe(true); });",
				"  it.each([[true]])('it.each case', (value) => { expect(value).toBe(true); });",
				"  test.each([[true]])('test.each case', (value) => { expect(value).toBe(true); });",
				"  describe('nested suite', () => {",
				"    it('nested it case', () => { expect(true).toBe(true); });",
				"  });",
				"});",
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

		expect(violations.filter((violation) => violation.rule_id() === "typescript-jest-test-in-describe")).toEqual([]);
	});
});
