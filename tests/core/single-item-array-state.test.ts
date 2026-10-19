import { describe, expect, jest, test } from "@jest/globals";
import { LintRunConfiguration } from "src/core/lint_run_configuration";
import { SourceText } from "src/source_text";
import { NodeFileIO } from "src/io/node_file_io";
import { TestFixture } from "tests/core/test-fixture";
import { TypeScriptTypeAliases } from "src/typescript-aliases/type_script_type_aliases";
import { TypeScriptArrayStateInspector } from "src/rules/typescript/syntax-rules/types/type_script_array_state_inspector";
import { TypeScriptBindingAliases } from "src/typescript-aliases/type_script_binding_aliases";
import { TypeScriptCallAliases } from "src/rules/typescript/syntax-rules/callables/type_script_call_aliases";
import { TypeScriptExpressionNames } from "src/typescript-aliases/type_script_expression_names";
import ts from "typescript";

/** Responsibilities: _repeated access source generation_, _array access extraction_. **/
class RepeatedArrayAccessSource {
	public readonly source_file: ts.SourceFile;

	/** Responsibilities: _repeated access source setup_. **/
	public constructor(access_count: number) {
		const lines = Array.from({ length: access_count }, (_, index) => `const item_${index} = values()[0];`);
		const source = `type Values = string[];\nfunction values(): Values { return ["value"]; }\n${lines.join("\n")}`;
		this.source_file = ts.createSourceFile("repeated-array-access.ts", source, ts.ScriptTarget.Latest, true);
	}

	/** Responsibilities: _element access collection_. **/
	public access_nodes(): ts.ElementAccessExpression[] {
		const nodes: ts.ElementAccessExpression[] = [];
		for (const statement of this.source_file.statements.filter(ts.isVariableStatement)) {
			const initializer = statement.declarationList.declarations[0]?.initializer;
			if (initializer !== undefined && ts.isElementAccessExpression(initializer)) {
				nodes.push(initializer);
			}
		}
		return nodes;
	}
}

describe("single-item array state analysis", () => {
	test("detects access through call aliases and direct array return types", () => {
		const fixture = new TestFixture();
		const violations = fixture
			.with_lint_request(
				new LintRunConfiguration(new SourceText(), new NodeFileIO()),
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
			.filter((item) => item.rule_id === "single-item-array-state");
		expect(violations).toHaveLength(5);
	});

	test("resolves readonly and qualified aliases without leaking across files", () => {
		const fixture = new TestFixture();
		const violations = fixture
			.with_lint_request(
				new LintRunConfiguration(new SourceText(), new NodeFileIO()),
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
				},
				(production_lint_configuration, options, mode) =>
					production_lint_configuration.lint_report(options, mode).report.violations,
			)
			.filter((item) => item.rule_id === "single-item-array-state");
		const array_alias_violations = violations.filter((item) => item.file.includes("array-alias-"));
		expect({
			count: violations.length,
			array_alias_count: array_alias_violations.length,
			array_alias_file: array_alias_violations[0]?.file,
		}).toEqual({
			count: 6,
			array_alias_count: 1,
			array_alias_file: expect.stringContaining("array-alias-source.ts"),
		});
	});

	test("reuses array alias analysis for repeated accesses in one source", () => {
		const access_count = 40;
		const collect = jest.spyOn(TypeScriptTypeAliases.prototype, "collect");
		const source = new RepeatedArrayAccessSource(access_count);
		const expression_names = new TypeScriptExpressionNames();
		const call_aliases = new TypeScriptCallAliases(expression_names, new TypeScriptBindingAliases(expression_names));
		const inspector = new TypeScriptArrayStateInspector(expression_names, call_aliases);
		const matching_accesses = source
			.access_nodes()
			.filter((node) => inspector.single_item_access(node, source.source_file)).length;
		const alias_inventory_builds = collect.mock.calls.length;
		collect.mockRestore();
		expect({ matching_accesses, alias_inventory_builds }).toEqual({
			matching_accesses: access_count,
			alias_inventory_builds: 1,
		});
	});
});
