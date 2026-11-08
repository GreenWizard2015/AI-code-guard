import "src/rules/typescript/syntax-rules/types/rest_union/rest_union_rule";
import { LintRunConfiguration } from "src/core/lint_run_configuration";
import { NodeFileIO } from "src/io/node_file_io";
import { SourceText } from "src/io/source_text";
import "src/rules/typescript/syntax-rules/runtime/type_script_basic_rules";
import { describe, expect, test } from "@jest/globals";
import { TestFixture } from "tests/core/test-fixture";

describe("coding-lint type boundary rules", () => {
	test("keeps imported TypeScript interfaces out of the concrete project class boundary", () => {
		const test_fixture = new TestFixture();
		const violations = test_fixture.with_lint_request(
			new LintRunConfiguration(new SourceText(), new NodeFileIO(process.cwd())),
			{
				"typescript_runtime_protocols.ts": [
					"export interface TypeScriptTypeNameLookupContract {",
					"  contains(name: string): boolean;",
					"}",
				].join("\n"),
				"object_literal_return_rules.ts": [
					"import type { TypeScriptTypeNameLookupContract } from './typescript_runtime_protocols';",
					"type ObjectReturnAnalysis = {",
					"  contract_names: TypeScriptTypeNameLookupContract;",
					"};",
				].join("\n"),
			},
			(production_lint_configuration, options, mode) =>
				production_lint_configuration.lint_report(options, mode).report.violations,
		);

		expect(violations.filter((item) => item.rule_id() === "project-type-boundary")).toEqual([]);
	});

	test("requires a class contract for primitive unions at boundaries", () => {
		const test_fixture = new TestFixture();
		const violations = test_fixture.with_lint_request(
			new LintRunConfiguration(new SourceText(), new NodeFileIO(process.cwd())),
			{
				"bridge-result.ts": "type BridgeResult = { stderr: Buffer | string; };",
			},
			(production_lint_configuration, options, mode) =>
				production_lint_configuration.lint_report(options, mode).report.violations,
		);

		expect(violations.map((item) => ({ rule_id: item.rule_id(), priority: item.priority() }))).toContainEqual({
			rule_id: "composite-state-type",
			priority: 6,
		});
	});

	test("rejects fields typed as nullish values", () => {
		const test_fixture = new TestFixture();
		const violations = test_fixture.with_lint_request(
			new LintRunConfiguration(new SourceText(), new NodeFileIO(process.cwd())),
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

		expect(
			violations
				.filter((item) => item.rule_id() === "nullable-domain-type")
				.map((item) => `${item.file()}:${item.line()}`)
				.sort(),
		).toEqual([
			"nullish-fields.ts:2",
			"nullish-fields.ts:3",
			"nullish-fields.ts:4",
			"nullish-fields.ts:5",
			"nullish-fields.ts:6",
		]);
	});

	test("rejects unbounded TypeScript and Python types at source and markdown boundaries", () => {
		const test_fixture = new TestFixture();
		const violations = test_fixture.with_lint_request(
			new LintRunConfiguration(new SourceText(), new NodeFileIO(process.cwd())),
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

		const unbounded = violations.filter((item) => item.rule_id() === "unbounded-type");
		expect({
			unbounded_source: unbounded
				.filter((item) => item.file().startsWith("unbounded."))
				.map((item) => `${item.file()}:${item.line()}`)
				.sort(),
			markdown_typescript: unbounded
				.filter((item) => item.file() === "markdown-boundaries.ts")
				.map((item) => `${item.file()}:${item.line()}`)
				.sort(),
			markdown_python: unbounded
				.filter((item) => item.file() === "markdown-boundaries.py")
				.map((item) => `${item.file()}:${item.line()}`)
				.sort(),
			local_unknown_allowed: unbounded.some(
				(item) => item.file().startsWith("markdown-boundaries.") && item.line() === 6,
			),
		}).toEqual({
			unbounded_source: [
				"unbounded.py:3",
				"unbounded.py:4",
				"unbounded.py:4",
				"unbounded.ts:1",
				"unbounded.ts:1",
				"unbounded.ts:2",
				"unbounded.ts:2",
			],
			markdown_typescript: [
				"markdown-boundaries.ts:1",
				"markdown-boundaries.ts:1",
				"markdown-boundaries.ts:2",
				"markdown-boundaries.ts:4",
				"markdown-boundaries.ts:5",
				"markdown-boundaries.ts:5",
			],
			markdown_python: [
				"markdown-boundaries.py:2",
				"markdown-boundaries.py:4",
				"markdown-boundaries.py:5",
				"markdown-boundaries.py:5",
				"markdown-boundaries.py:8",
			],
			local_unknown_allowed: false,
		});
	});

	test("rejects undefined checks for required fields", () => {
		const test_fixture = new TestFixture();
		const violations = test_fixture.with_lint_request(
			new LintRunConfiguration(new SourceText(), new NodeFileIO(process.cwd())),
			{
				"required-field-check.ts": [
					"type Parsed = { attribute_accesses: string[] };",
					"function has_attributes(parsed: Parsed): boolean {",
					"  return parsed.attribute_accesses === undefined;",
					"}",
				].join("\n"),
				"optional-field-access.ts": [
					"type Parsed = { attribute_accesses: string[] };",
					"function has_attributes(parsed: Parsed): boolean {",
					"  return parsed?.attribute_accesses.length > 0 && (parsed)?.attribute_accesses.length > 0;",
					"}",
				].join("\n"),
			},
			(production_lint_configuration, options, mode) =>
				production_lint_configuration.lint_report(options, mode).report.violations,
		);

		const unnecessary_checks = violations.filter((item) => item.rule_id() === "unnecessary-undefined-check");
		expect(unnecessary_checks.map((item) => `${item.file()}:${item.line()}`).sort()).toEqual([
			"optional-field-access.ts:3",
			"optional-field-access.ts:3",
			"required-field-check.ts:3",
		]);
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
			new LintRunConfiguration(new SourceText(), new NodeFileIO(process.cwd())),
			files,
			(production_lint_configuration, options, mode) =>
				production_lint_configuration.lint_report(options, mode).report.violations,
		);

		expect({
			type_guard: violations
				.filter((item) => item.rule_id() === "typescript-type-guard")
				.map((item) => ({ file: item.file(), rule_id: item.rule_id(), priority: item.priority() })),
			instance_checks: violations
				.filter((item) => item.rule_id() === "typescript-instanceof")
				.map((item) => `${item.file()}:${item.line()}`),
		}).toEqual({
			type_guard: [{ file: "type-guard.ts", rule_id: "typescript-type-guard", priority: 5 }],
			instance_checks: ["type-guard.ts:3", "type-guard.ts:6"],
		});
	});

	test("rejects unknown parameter and aliased boundary types", () => {
		const test_fixture = new TestFixture();
		const violations = test_fixture.with_lint_request(
			new LintRunConfiguration(new SourceText(), new NodeFileIO(process.cwd())),
			{
				"unknown-parameter.ts": "function parse_value(value: unknown): string { return String(value); }",
				"unknown-alias.ts": [
					"type UnknownAlias = unknown;",
					"function parse_value(value: UnknownAlias): UnknownAlias { return value; }",
				].join("\n"),
				"unbounded-alias.ts": [
					"type UnknownAlias = unknown;",
					"function read_value(value: UnknownAlias): UnknownAlias { return value; }",
				].join("\n"),
			},
			(production_lint_configuration, options, mode) =>
				production_lint_configuration.lint_report(options, mode).report.violations,
		);

		const unknown_parameter = violations.filter((item) => item.rule_id() === "typescript-unknown-parameter-type");
		const aliased_unknown = violations.filter((item) => item.file() === "unknown-alias.ts");
		const type_info = aliased_unknown.filter((item) => item.rule_id() === "type-info");
		const unknown_alias_parameters = aliased_unknown.filter(
			(item) => item.rule_id() === "typescript-unknown-parameter-type",
		);
		const unbounded_alias = violations.filter(
			(item) => item.rule_id() === "unbounded-type" && item.file() === "unbounded-alias.ts",
		);
		expect({
			unknown_parameter: unknown_parameter.map((item) => ({
				file: item.file(),
				line: item.line(),
				message: item.message(),
			})),
			type_info_findings: type_info.map((item) => ({ file: item.file(), line: item.line(), message: item.message() })),
			unknown_alias_parameters: unknown_alias_parameters.map(
				(item) => `${item.file()}:${item.line()}:${item.message()}`,
			),
			unbounded_alias_locations: unbounded_alias.map((item) => `${item.file()}:${item.line()}`),
		}).toEqual({
			unknown_parameter: [
				{
					file: "unbounded-alias.ts",
					line: 2,
					message: 'parameter "value" must not use unknown',
				},
				{
					file: "unknown-alias.ts",
					line: 2,
					message: 'parameter "value" must not use unknown',
				},
				{
					file: "unknown-parameter.ts",
					line: 1,
					message: 'parameter "value" must not use unknown',
				},
			],
			type_info_findings: [
				expect.objectContaining({ file: "unknown-alias.ts" }),
				expect.objectContaining({ file: "unknown-alias.ts" }),
			],
			unknown_alias_parameters: ['unknown-alias.ts:2:parameter "value" must not use unknown'],
			unbounded_alias_locations: ["unbounded-alias.ts:1", "unbounded-alias.ts:2", "unbounded-alias.ts:2"],
		});
	});
});
