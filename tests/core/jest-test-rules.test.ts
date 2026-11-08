import { describe, expect, test } from "@jest/globals";
import { LintRunConfiguration } from "src/core/lint_run_configuration";
import { NodeFileIO } from "src/io/node_file_io";
import { SourceText } from "src/io/source_text";
import { TestFixture } from "tests/core/test-fixture";

describe("Jest assertion and structure rules", () => {
	test("reports mixed-module for every module-level declaration kind beside Jest tests", () => {
		const fixture = new TestFixture();
		const declarations = [
			"class FixtureClass {}",
			"function fixture_function(): void {}",
			"const fixture_value = true;",
			"type FixtureType = string;",
			"interface FixtureContract {}",
			"enum FixtureState { Ready }",
			"namespace FixtureNamespace {}",
		];
		const mixed_test_files = Object.fromEntries(
			declarations.map((declaration, index) => [
				`tests/mixed-entity-${index}.test.ts`,
				[
					declaration,
					"describe('subject', () => {",
					"  test('works', () => {",
					"    const local_value = true;",
					"    expect(local_value).toBe(true);",
					"  });",
					"});",
				].join("\n"),
			]),
		);
		const violations = fixture.with_lint_request(
			new LintRunConfiguration(new SourceText(), new NodeFileIO(process.cwd())),
			{
				...mixed_test_files,
				"tests/imports-only.test.ts": [
					"import { describe, expect, test } from '@jest/globals';",
					"describe('subject', () => { test('works', () => { expect(true).toBe(true); }); });",
				].join("\n"),
			},
			(production_lint_configuration, options, mode) =>
				production_lint_configuration.lint_report(options, mode).report.violations,
		);
		const mixed_module_violations = violations.filter((item) => item.rule_id() === "mixed-module");
		expect(mixed_module_violations.map((item) => item.file())).toEqual(
			declarations.map((_, index) => `tests/mixed-entity-${index}.test.ts`),
		);
	});

	test("requires direct, final assertions and rejects nested suites", () => {
		const fixture = new TestFixture();
		const violations = fixture.with_lint_request(
			new LintRunConfiguration(new SourceText(), new NodeFileIO(process.cwd())),
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
			missing_direct_expect: violations.filter((item) => item.rule_id() === "typescript-jest-test-expect").length,
			unfinished_assertions: violations.filter((item) => item.rule_id() === "typescript-jest-test-ending").length,
			nested_suites: violations.filter((item) => item.rule_id() === "typescript-jest-nested-describe").length,
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
			new LintRunConfiguration(new SourceText(), new NodeFileIO(process.cwd())),
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
			minimum: violations.filter((item) => item.rule_id() === "test-min-count").length,
			maximum: violations.filter((item) => item.rule_id() === "test-max-count").length,
			ending: violations.filter((item) => item.rule_id() === "typescript-jest-test-ending").length,
		}).toEqual({ minimum: 2, maximum: 1, ending: 1 });
	});

	test("counts every static test.each row as a test case", () => {
		const fixture = new TestFixture();
		const rows = Array.from({ length: 16 }, (_, index) => `    { value: ${index} },`).join("\n");
		const violations = fixture.with_lint_request(
			new LintRunConfiguration(new SourceText(), new NodeFileIO(process.cwd())),
			{
				"tests/parameterized.test.ts": [
					"describe('parameterized', () => {",
					"  type ParameterizedCase = { value: number };",
					"  test.each<ParameterizedCase>([",
					rows,
					"  ])('case $value', ({ value }) => { expect(value).toBeDefined(); });",
					"});",
				].join("\n"),
				"tests/parameterized-minimum.test.ts": [
					"describe('parameterized minimum', () => {",
					"  type ParameterizedCase = { value: number };",
					"  test.each<ParameterizedCase>([{ value: 1 }, { value: 2 }])('case $value', ({ value }) => {",
					"    expect(value).toBeDefined();",
					"  });",
					"});",
				].join("\n"),
			},
			(production_lint_configuration, options, mode) =>
				production_lint_configuration.lint_report(options, mode).report.violations,
		);
		const count_violation = violations.find((item) => item.rule_id() === "test-max-count");
		let maximum_message = "";
		if (count_violation !== undefined) {
			maximum_message = count_violation.message();
		}

		expect(maximum_message).toContain("found 16");
		expect(
			violations.some(
				(item) => item.rule_id() === "test-min-count" && item.file() === "tests/parameterized-minimum.test.ts",
			),
		).toBe(false);
	});
});
