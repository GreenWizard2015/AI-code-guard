import { describe, expect, test } from "@jest/globals";
import { LintRunConfiguration } from "src/core/lint_run_configuration";
import { SourceText } from "src/source_text";
import { NodeFileIO } from "src/io/node_file_io";
import { TestFixture } from "tests/core/test-fixture";

describe("Jest assertion and structure rules", () => {
	test("requires direct, final assertions and rejects nested suites", () => {
		const fixture = new TestFixture();
		const violations = fixture.with_lint_request(
			new LintRunConfiguration(new SourceText(), new NodeFileIO()),
			{
				"tests/nested-expect.test.ts": [
					"describe('nested expect', () => {",
					"  test('nested assertion', () => {",
					"    run(() => { expect(true).toBe(true); });",
					"  });",
					"});",
				].join("\n"),
				"tests/direct-expect.test.ts": [
					"describe('direct expect', () => {",
					"  test('direct assertion', () => {",
					"    expect(true).toBe(true);",
					"    (expect)(true).toBe(true);",
					"    const check = expect;",
					"    check(true).toBe(true);",
					"  });",
					"});",
				].join("\n"),
				"tests/conditional-expect.test.ts":
					"describe('condition', () => { test('result', () => { expect(true).toBe(true); if (true) { expect(false).toBe(false); } }); });",
				"tests/expect-alias-ending.test.ts": [
					"describe('suite', () => {",
					"  test('case', () => {",
					"    const check = expect;",
					"    check(1).toBe(1);",
					"    do_cleanup();",
					"  });",
					"  test('second', () => { expect(1).toBe(1); });",
					"});",
				].join("\n"),
				"tests/parenthesized-expect-ending.test.ts": [
					"describe('suite', () => {",
					"  test('case', () => {",
					"    (expect)(1).toBe(1);",
					"    do_cleanup();",
					"  });",
					"  test('second', () => { expect(1).toBe(1); });",
					"});",
				].join("\n"),
				"tests/parenthesized-describe.test.ts": [
					"describe('root', () => {",
					"  (describe)('nested', () => {",
					"    test('value', () => { expect(true).toBe(true); });",
					"  });",
					"  const nested_alias = describe;",
					"  nested_alias('nested alias', () => { test('alias value', () => { expect(true).toBe(true); }); });",
					"});",
				].join("\n"),
				"tests/test-alias.test.ts": [
					"describe('suite', () => {",
					"  const check = test;",
					"  check('one', () => { const value_only = value; });",
					"});",
				].join("\n"),
				"tests/data-driven.test.ts": [
					"describe.each([[1]])('suite', () => {",
					"  test('missing assertion', () => { const value = 1; void value; });",
					"});",
				].join("\n"),
			},
			(production_lint_configuration, options, mode) =>
				production_lint_configuration.lint_report(options, mode).report.violations,
		);
		expect({
			missing_direct_expect: violations.filter((item) => item.rule_id === "typescript-jest-test-expect").length,
			unfinished_assertions: violations.filter((item) => item.rule_id === "typescript-jest-test-ending").length,
			nested_suites: violations.filter((item) => item.rule_id === "typescript-jest-nested-describe").length,
		}).toEqual({ missing_direct_expect: 3, unfinished_assertions: 5, nested_suites: 2 });
	});

	test("applies file, suite, and modifier rules to every Jest test file", () => {
		const fixture = new TestFixture();
		const modifier_test_lines = [
			"describe.only('suite', () => {",
			Array.from(
				{ length: 16 },
				(_, index) => `  test.only('case ${index}', () => { expect(true).toBe(true); });`,
			).join("\n"),
			"});",
		];
		const modifier_test_source = modifier_test_lines.join("\n");
		const violations = fixture.with_lint_request(
			new LintRunConfiguration(new SourceText(), new NodeFileIO()),
			{
				"tests/spec-file.spec.ts": [
					"describe('spec file', () => {",
					"  test('only case', () => { expect(true).toBe(true); });",
					"});",
				].join("\n"),
				"tests/modifiers.test.ts": modifier_test_source,
				"tests/computed-modifiers.test.ts": [
					'describe["skip"]("suite", () => {',
					"  test('case', () => {",
					"    expect(true).toBe(true);",
					"    do_cleanup();",
					"  });",
					"});",
				].join("\n"),
			},
			(production_lint_configuration, options, mode) =>
				production_lint_configuration.lint_report(options, mode).report.violations,
		);
		expect({
			minimum: violations.filter((item) => item.rule_id === "test-min-count").length,
			maximum: violations.filter((item) => item.rule_id === "test-max-count").length,
			ending: violations.filter((item) => item.rule_id === "typescript-jest-test-ending").length,
		}).toEqual({ minimum: 2, maximum: 1, ending: 1 });
	});
});
