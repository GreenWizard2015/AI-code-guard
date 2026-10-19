import "src/rules/typescript/syntax-rules/types/rest_union_contract_rule";
import { LintRunConfiguration } from "src/core/lint_run_configuration";
import { SourceText } from "src/source_text";
import { NodeFileIO } from "src/io/node_file_io";
import "src/rules/typescript/syntax-rules/runtime/type_script_basic_rules";
import { describe, expect, test } from "@jest/globals";
import { TestFixture } from "tests/core/test-fixture";

describe("coding-lint type boundary rules", () => {
	test("requires a class contract for primitive unions at boundaries", () => {
		const test_fixture = new TestFixture();
		const violations = test_fixture.with_lint_request(
			new LintRunConfiguration(new SourceText(), new NodeFileIO()),
			{
				"bridge-result.ts": "type BridgeResult = { stderr: Buffer | string; };",
			},
			(production_lint_configuration, options, mode) =>
				production_lint_configuration.lint_report(options, mode).report.violations,
		);

		expect(violations).toContainEqual(
			expect.objectContaining({
				rule_id: "composite-state-type",
				priority: 6,
			}),
		);
	});

	test("rejects fields typed as nullish values", () => {
		const test_fixture = new TestFixture();
		const violations = test_fixture.with_lint_request(
			new LintRunConfiguration(new SourceText(), new NodeFileIO()),
			{
				"nullish-fields.ts": [
					"type NullishFields = {",
					"  missing: null;",
					"  absent: undefined;",
					"  impossible: never;",
					"  opaque: unknown;",
					"  unchecked: any;",
					"};",
				].join("\n"),
			},
			(production_lint_configuration, options, mode) =>
				production_lint_configuration.lint_report(options, mode).report.violations,
		);

		expect(violations.filter((item) => item.rule_id === "nullable-domain-type")).toHaveLength(5);
	});

	test("rejects unbounded TypeScript and Python types everywhere", () => {
		const test_fixture = new TestFixture();
		const violations = test_fixture.with_lint_request(
			new LintRunConfiguration(new SourceText(), new NodeFileIO()),
			{
				"unbounded.ts": [
					"type Unbounded = { value: unknown; fallback: any; };",
					"function read(value: unknown): any { return value; }",
				].join("\n"),
				"unbounded.py": [
					"from typing import Any",
					"class Reader:",
					"    value: Any",
					"    def read(self, value: Any) -> Any:",
					"        return value",
				].join("\n"),
			},
			(production_lint_configuration, options, mode) =>
				production_lint_configuration.lint_report(options, mode).report.violations,
		);

		expect(violations.filter((item) => item.rule_id === "unbounded-type")).toHaveLength(7);
	});

	test("rejects TypeScript markdown boundary examples", () => {
		const test_fixture = new TestFixture();
		const violations = test_fixture.with_lint_request(
			new LintRunConfiguration(new SourceText(), new NodeFileIO()),
			{
				"markdown-boundaries.ts": [
					"type Boundary = { value: unknown; payload: Record<string, object>; };",
					"const module_value: any = {};",
					"class Reader {",
					"  public field: object;",
					"  public read(value: any): object {",
					"    const local: unknown = value;",
					"    return local;",
					"  }",
					"}",
				].join("\n"),
			},
			(production_lint_configuration, options, mode) =>
				production_lint_configuration.lint_report(options, mode).report.violations,
		);

		const unbounded = violations.filter((item) => item.rule_id === "unbounded-type");
		expect(unbounded).toHaveLength(6);
		expect(unbounded.filter((item) => item.line === 6)).toHaveLength(0);
	});

	test("rejects Python markdown boundary examples", () => {
		const test_fixture = new TestFixture();
		const violations = test_fixture.with_lint_request(
			new LintRunConfiguration(new SourceText(), new NodeFileIO()),
			{
				"markdown-boundaries.py": [
					"from typing import Any",
					"bridge_result: dict[str, Any] = {}",
					"class Reader:",
					"    field: object",
					"    def read(self, value: Any) -> object:",
					"        local: Any = value",
					"        return value",
					"schema: TypeAlias = dict[str, Any]",
				].join("\n"),
			},
			(production_lint_configuration, options, mode) =>
				production_lint_configuration.lint_report(options, mode).report.violations,
		);

		const unbounded = violations.filter((item) => item.rule_id === "unbounded-type");
		expect(unbounded).toHaveLength(5);
		expect(unbounded.filter((item) => item.line === 6)).toHaveLength(0);
	});

	test("rejects undefined checks for required fields", () => {
		const test_fixture = new TestFixture();
		const violations = test_fixture.with_lint_request(
			new LintRunConfiguration(new SourceText(), new NodeFileIO()),
			{
				"required-field-check.ts": [
					"type Parsed = { attribute_accesses: string[] };",
					"function has_attributes(parsed: Parsed): boolean {",
					"  return parsed.attribute_accesses === undefined;",
					"}",
				].join("\n"),
			},
			(production_lint_configuration, options, mode) =>
				production_lint_configuration.lint_report(options, mode).report.violations,
		);

		expect(violations).toContainEqual(
			expect.objectContaining({
				rule_id: "unnecessary-undefined-check",
				priority: 5,
			}),
		);
	});

	test("rejects optional access to required fields", () => {
		const test_fixture = new TestFixture();
		const files = {
			"optional-field-access.ts": [
				"type Parsed = { attribute_accesses: string[] };",
				"function has_attributes(parsed: Parsed): boolean {",
				"  return parsed?.attribute_accesses.length > 0 && (parsed)?.attribute_accesses.length > 0;",
				"}",
			].join("\n"),
		};
		const violations = test_fixture.with_lint_request(
			new LintRunConfiguration(new SourceText(), new NodeFileIO()),
			files,
			(production_lint_configuration, options, mode) =>
				production_lint_configuration.lint_report(options, mode).report.violations,
		);

		expect(violations).toContainEqual(
			expect.objectContaining({
				rule_id: "unnecessary-undefined-check",
				priority: 5,
			}),
		);
	});

	test("rejects TypeScript is type guards", () => {
		const test_fixture = new TestFixture();
		const files = {
			"type-guard.ts": [
				"class User {}",
				"function is_user(value: unknown): value is User {",
				"  return value instanceof User;",
				"}",
				"function is_user_by_prototype(value: unknown): boolean {",
				"  return User.prototype.isPrototypeOf(value);",
				"}",
			].join("\n"),
		};
		const violations = test_fixture.with_lint_request(
			new LintRunConfiguration(new SourceText(), new NodeFileIO()),
			files,
			(production_lint_configuration, options, mode) =>
				production_lint_configuration.lint_report(options, mode).report.violations,
		);

		expect(violations).toContainEqual(
			expect.objectContaining({
				rule_id: "typescript-type-guard",
				priority: 5,
			}),
		);
		expect(violations.filter((item) => item.rule_id === "typescript-instanceof")).toHaveLength(2);
	});

	test("rejects unknown parameter types", () => {
		const test_fixture = new TestFixture();
		const files = {
			"unknown-parameter.ts": "function parse_value(value: unknown): string { return String(value); }",
		};
		const violations = test_fixture.with_lint_request(
			new LintRunConfiguration(new SourceText(), new NodeFileIO()),
			files,
			(production_lint_configuration, options, mode) =>
				production_lint_configuration.lint_report(options, mode).report.violations,
		);

		expect(violations).toContainEqual(
			expect.objectContaining({
				rule_id: "typescript-unknown-parameter-type",
				priority: 5,
				message: 'parameter "value" must not use unknown',
			}),
		);
	});

	test("rejects aliased unknown parameter and return types", () => {
		const test_fixture = new TestFixture();
		const files = {
			"unknown-alias.ts": [
				"type UnknownAlias = unknown;",
				"function parse_value(value: UnknownAlias): UnknownAlias { return value; }",
			].join("\n"),
		};
		const violations = test_fixture.with_lint_request(
			new LintRunConfiguration(new SourceText(), new NodeFileIO()),
			files,
			(production_lint_configuration, options, mode) =>
				production_lint_configuration.lint_report(options, mode).report.violations,
		);

		expect(violations.filter((item) => item.rule_id === "type-info")).toHaveLength(2);
		expect(violations.filter((item) => item.rule_id === "typescript-unknown-parameter-type")).toHaveLength(1);
	});

	test("rejects aliased unbounded boundary types", () => {
		const test_fixture = new TestFixture();
		const files = {
			"unbounded-alias.ts": [
				"type UnknownAlias = unknown;",
				"function read_value(value: UnknownAlias): UnknownAlias { return value; }",
			].join("\n"),
		};
		const violations = test_fixture.with_lint_request(
			new LintRunConfiguration(new SourceText(), new NodeFileIO()),
			files,
			(production_lint_configuration, options, mode) =>
				production_lint_configuration.lint_report(options, mode).report.violations,
		);

		expect(violations.filter((item) => item.rule_id === "unbounded-type")).toHaveLength(3);
	});
});
