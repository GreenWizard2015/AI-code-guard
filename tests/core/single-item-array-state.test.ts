import { describe, expect, test } from "@jest/globals";
import { LintRunConfiguration } from "src/core/lint_run_configuration";
import { NodeFileIO } from "src/io/node_file_io";
import { SourceText } from "src/io/source_text";
import { TestFixture } from "tests/core/test-fixture";

describe("single-item array state analysis", () => {
	test("detects the first result extracted through array destructuring", () => {
		const fixture = new TestFixture();
		const violations = fixture
			.with_lint_request(
				new LintRunConfiguration(new SourceText(), new NodeFileIO(process.cwd())),
				{
					"destructured-result.ts": [
						"interface UserRecord { user_id: string; }",
						"function find_users(owner_id: string): UserRecord[] {",
						"  if (owner_id.length > 0) {",
						"    return [{ user_id: owner_id }];",
						"  }",
						"  return [];",
						"}",
						'const [user] = find_users("owner-17");',
						'const [, later_user] = find_users("owner-19");',
						"console.log(user?.user_id);",
						"function list_users(): UserRecord[] {",
						'  return [{ user_id: "first" }, { user_id: "second" }];',
						"}",
						"const [first_user] = list_users();",
					].join("\n"),
					"destructured-call-alias.ts": [
						"interface UserRecord { user_id: string; }",
						"function find_users(owner_id: string): UserRecord[] {",
						"  if (owner_id.length > 0) {",
						"    return [{ user_id: owner_id }];",
						"  }",
						"  return [];",
						"}",
						"const get_users = find_users;",
						'const [user] = get_users("owner-17");',
					].join("\n"),
					"destructured-conditional.ts": [
						"interface UserRecord { user_id: string; }",
						"function find_users(owner_id: string): UserRecord[] {",
						"  return owner_id.length > 0 ? [{ user_id: owner_id }] : [];",
						"}",
						'const [user] = find_users("owner-17");',
						'const indexed_user = find_users("owner-18")[0];',
					].join("\n"),
				},
				(production_lint_configuration, options, mode) =>
					production_lint_configuration.lint_report(options, mode).report.violations,
			)
			.filter((item) => item.rule_id() === "single-item-array-state");

		expect(violations).toHaveLength(6);
	});

	test("detects access through call aliases and direct array return types", () => {
		const fixture = new TestFixture();
		const violations = fixture
			.with_lint_request(
				new LintRunConfiguration(new SourceText(), new NodeFileIO(process.cwd())),
				{
					"non-null-index.ts": [
						'function values(): string[] { return ["value"]; }',
						"const get_values = values!;",
						"const candidate = get_values()[0];",
					].join("\n"),
					"non-null-at.ts": [
						'function values(): string[] { return ["value"]; }',
						"const get_values = values!;",
						"const candidate = get_values().at(0);",
					].join("\n"),
					"parenthesized.ts": [
						'function values(): string[] { return ["value"]; }',
						"const get_values = (values);",
						"const candidate = get_values()[0];",
					].join("\n"),
					"type-alias.ts": [
						"type Values = string[];",
						'function values(): Values { return ["value"]; }',
						"const candidate = values()[0];",
					].join("\n"),
					"readonly.ts": [
						"function get_items(): readonly string[] {",
						"  return ['item'];",
						"}",
						"const first_item = get_items()[0];",
					].join("\n"),
				},
				(production_lint_configuration, options, mode) =>
					production_lint_configuration.lint_report(options, mode).report.violations,
			)
			.filter((item) => item.rule_id() === "single-item-array-state");
		expect(violations).toHaveLength(5);
	});

	test("detects zero access through both indexing and at", () => {
		const fixture = new TestFixture();
		const violations = fixture
			.with_lint_request(
				new LintRunConfiguration(new SourceText(), new NodeFileIO(process.cwd())),
				{
					"indexed-result.ts": ['function values(): string[] { return ["value"]; }', "const item = values()[0];"].join(
						"\n",
					),
					"at-result.ts": ['function values(): string[] { return ["value"]; }', "const item = values().at(0);"].join(
						"\n",
					),
					"arguments-unpack.ts": [
						"declare const source: { arguments: unknown[]; entries: unknown[] };",
						"const [context] = source.arguments;",
						"const [entry] = source.entries;",
					].join("\n"),
					"nonzero-at-result.ts": [
						'function values(): string[] { return ["value"]; }',
						"const item = values().at(1);",
					].join("\n"),
				},
				(production_lint_configuration, options, mode) =>
					production_lint_configuration.lint_report(options, mode).report.violations,
			)
			.filter((item) => item.rule_id() === "single-item-array-state");
		const reported_files = violations.map((item) => item.file()).sort();

		expect(violations).toHaveLength(4);
		expect(reported_files).toEqual(["arguments-unpack.ts", "arguments-unpack.ts", "at-result.ts", "indexed-result.ts"]);
	});

	test("does not treat ordinary first or last collection access as a single-item result", () => {
		const fixture = new TestFixture();
		const violations = fixture
			.with_lint_request(
				new LintRunConfiguration(new SourceText(), new NodeFileIO(process.cwd())),
				{
					"collection-index.ts": [
						'function find_value(): string[] { return ["value"]; }',
						"const result = find_value()[0];",
						'const path_parts = "root/file.py".split("/");',
						"const file_name = path_parts[path_parts.length - 1];",
						"const root_part = path_parts[0];",
						"console.log(result, file_name, root_part);",
					].join("\n"),
				},
				(production_lint_configuration, options, mode) =>
					production_lint_configuration.lint_report(options, mode).report.violations,
			)
			.filter((item) => item.rule_id() === "single-item-array-state");

		expect(violations.map((item) => item.line())).toEqual([2]);
	});

	test("resolves readonly and qualified aliases without leaking across files", () => {
		const fixture = new TestFixture();
		const violations = fixture
			.with_lint_request(
				new LintRunConfiguration(new SourceText(), new NodeFileIO(process.cwd())),
				{
					"readonly-alias.ts": [
						"type InnerValues = readonly string[];",
						"type Values = InnerValues;",
						"type GenericValues = Readonly<string[]>;",
						'function values(): Values { return ["value"]; }',
						'function generic_values(): GenericValues { return ["value"]; }',
						"const first_value = values()[0];",
						"const first_generic_value = generic_values()[0];",
					].join("\n"),
					"nested-readonly-alias.ts": [
						"type Items = Array<string>;",
						"type Values = Readonly<Items>;",
						'function values(): Values { return ["value"]; }',
						"const first_value = values()[0];",
					].join("\n"),
					"generic-alias.ts": [
						"type Values = ReadonlyArray<string>;",
						'function values(): Values { return ["value"]; }',
						"const candidate = values().at(0);",
					].join("\n"),
					"qualified-alias.ts": [
						"namespace Domain { export type Values = string[]; }",
						'function values(): Domain.Values { return ["value"]; }',
						"const candidate = values()[0];",
					].join("\n"),
					"array-alias-source.ts": [
						"type Values = string[];",
						'function values(): Values { return ["value"]; }',
						"const first_value = values()[0];",
					].join("\n"),
					"array-alias-consumer.ts": [
						'function values(): Values { return ["value"]; }',
						"const first_value = values()[0];",
					].join("\n"),
					"builtin-array-types.ts": [
						'function mutable_values(): Array<string> { return ["value"]; }',
						'function readonly_values(): ReadonlyArray<string> { return ["value"]; }',
						"const first_mutable = mutable_values()[0];",
						"const first_readonly = readonly_values()[0];",
					].join("\n"),
					"scalar-alias.ts": [
						"type Scalar = string;",
						'function scalar(): Scalar { return "value"; }',
						"const first_character = scalar()[0];",
					].join("\n"),
				},
				(production_lint_configuration, options, mode) =>
					production_lint_configuration.lint_report(options, mode).report.violations,
			)
			.filter((item) => item.rule_id() === "single-item-array-state");
		const array_alias_violations = violations.filter((item) => item.file().includes("array-alias-"));
		const array_alias_file = array_alias_violations
			.map((item) => item.file())
			.find((file) => file.includes("array-alias-"));
		expect({
			count: violations.length,
			array_alias_count: array_alias_violations.length,
			array_alias_file,
		}).toEqual({
			count: 8,
			array_alias_count: 1,
			array_alias_file: expect.stringContaining("array-alias-source.ts"),
		});
	});
});
