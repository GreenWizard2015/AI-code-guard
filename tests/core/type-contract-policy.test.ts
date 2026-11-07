import { describe, expect, test } from "@jest/globals";
import { LintRunConfiguration } from "src/core/lint_run_configuration";
import { NodeFileIO } from "src/io/node_file_io";
import { SourceText } from "src/io/source_text";
import { TestFixture } from "tests/core/test-fixture";

describe("type contract policies", () => {
	test("reports every interface field, including readonly snapshots", () => {
		const fixture = new TestFixture();
		const violations = fixture.with_lint_request(
			new LintRunConfiguration(new SourceText(), new NodeFileIO(process.cwd())),
			{
				"io.ts": [
					"interface MutableStoreContract { cache: Map<string, string>; }",
					"interface FileEntry { readonly name: string; readonly is_file: boolean; }",
				].join("\n"),
			},
			(production_lint_configuration, options, mode) =>
				production_lint_configuration.lint_report(options, mode).report.violations,
		);
		const contract_fields = violations.filter((violation) => violation.rule_id() === "contract-fields");

		expect(contract_fields.map((violation) => violation.line()).sort()).toEqual([1, 2, 2]);
		expect(contract_fields.map((violation) => violation.message()).sort()).toEqual(
			[
				'interface "MutableStoreContract" must not declare any field "cache"',
				'interface "FileEntry" must not declare any field "name"',
				'interface "FileEntry" must not declare any field "is_file"',
			].sort(),
		);
	});

	test("reports invalid TypeScript and Python type contract shapes", () => {
		const fixture = new TestFixture();
		const violations = fixture.with_lint_request(
			new LintRunConfiguration(new SourceText(), new NodeFileIO(process.cwd())),
			{
				"alias.ts": "type AstClassNode = { base_class_name?: string; base_class_names?: string[]; };",
				"field-count.ts": [
					"type LargeType = {",
					Array.from({ length: 11 }, (_, index) => `  field_${index}: string;`).join("\n"),
					"};",
				].join("\n"),
				"field-count.py": [
					"class LargeType:",
					Array.from({ length: 11 }, (_, index) => `    field_${index}: str`).join("\n"),
				].join("\n"),
				"inline-union.ts": "type AstCallableReference = { kind: 'function' | 'method'; };",
				"array-state.ts": [
					"type Service = { value: string };",
					"function find_service(): Service[] { return []; }",
					"const service = find_service()[1];",
					"const at_service = find_service().at(0);",
				].join("\n"),
				"nullable.ts": [
					"export type AstStatementNode = {",
					"  kind: AstStatementKind;",
					"  line: number;",
					"  name?: string;",
					"  value_name?: string;",
					"  simple_alias?: boolean;",
					"  destructured?: boolean;",
					"};",
				].join("\n"),
				"union-contract.ts": [
					"type ViolationShapeBase = { file: string; line: number; };",
					"type ViolationShape =",
					"  | ViolationShapeBase",
					"  | (ViolationShapeBase & { readonly rule_id: string; readonly priority: ViolationPriority; });",
				].join("\n"),
				"qualified-union.ts": [
					"namespace ModelTypes { export type Node = { file: string; }; }",
					"type Candidate = ModelTypes.Node | (ModelTypes.Node & { line: number; });",
				].join("\n"),
				"state-union.ts": [
					"type UserLookup =",
					"  | { state: 'found'; user: User }",
					"  | { state: 'not-found'; reason: string };",
				].join("\n"),
			},
			(production_lint_configuration, options, mode) =>
				production_lint_configuration.lint_report(options, mode).report.violations,
		);
		expect(violations.map((item) => ({ file: item.file(), rule_id: item.rule_id(), line: item.line() }))).toEqual(
			expect.arrayContaining([
				{ file: "alias.ts", rule_id: "typescript-singular-plural-alias", line: expect.any(Number) },
				{ file: "field-count.ts", rule_id: "type-field-count", line: expect.any(Number) },
				{ file: "field-count.py", rule_id: "type-field-count", line: expect.any(Number) },
				{ file: "inline-union.ts", rule_id: "typescript-inline-union-type", line: expect.any(Number) },
				{ file: "array-state.ts", rule_id: "single-item-array-state", line: expect.any(Number) },
				{ file: "nullable.ts", rule_id: "nullable-domain-type", line: 4 },
				{ file: "union-contract.ts", rule_id: "typescript-union-contract-bypass", line: expect.any(Number) },
				{ file: "qualified-union.ts", rule_id: "typescript-union-contract-bypass", line: expect.any(Number) },
				{ file: "state-union.ts", rule_id: "composite-state-type", line: expect.any(Number) },
			]),
		);
	});

	test("accepts type contracts using named shapes and concrete state classes", () => {
		const fixture = new TestFixture();
		const violations = fixture.with_lint_request(
			new LintRunConfiguration(new SourceText(), new NodeFileIO(process.cwd())),
			{
				"valid.ts": [
					"type ClassName = string;",
					"type CallableKind = 'function' | 'method';",
					"type AstCallableReference = { kind: CallableKind; };",
					"interface ServiceContract { fetch(): Promise<Result>; }",
					"class FoundUser {}",
					"class MissingUser {}",
				].join("\n"),
				"valid.py": [
					"from typing import Protocol",
					"class ServiceContract(Protocol):",
					"    def fetch(self) -> Result: ...",
				].join("\n"),
			},
			(production_lint_configuration, options, mode) =>
				production_lint_configuration.lint_report(options, mode).report.violations,
		);
		const forbidden_type_rules = [
			"typescript-singular-plural-alias",
			"type-field-count",
			"typescript-inline-union-type",
			"single-item-array-state",
			"nullable-domain-type",
			"typescript-union-contract-bypass",
			"composite-state-type",
		];

		expect(violations.filter((violation) => forbidden_type_rules.includes(violation.rule_id()))).toEqual([]);
	});
});
