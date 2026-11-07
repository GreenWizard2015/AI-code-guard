import { describe, expect, test } from "@jest/globals";
import { LintRunConfiguration } from "src/core/lint_run_configuration";
import { NodeFileIO } from "src/io/node_file_io";
import { SourceText } from "src/io/source_text";
import { ARBITRARY_COMBINATION_FILES } from "tests/core/constants/ast_nodes/constants";
import { TestFixture } from "tests/core/test-fixture";

describe("shared parameter lint integration", () => {
	test("reports shared parameter sets and maximal bundles", () => {
		const fixture = new TestFixture();
		const violations = fixture.with_lint_request(
			new LintRunConfiguration(new SourceText(), new NodeFileIO(process.cwd())),
			{
				"three-functions.ts": [
					"class RequestData {}",
					"function first(value: RequestData) { return value; }",
					"function second(value: RequestData) { return value; }",
					"function third(value: RequestData) { return value; }",
				].join("\n"),
				"parameter-combination.ts": [
					"class RequestOptions {}",
					"function first(request: RequestOptions, id: string) { return [request, id]; }",
					"function second(request: RequestOptions, id: string) { return [request, id]; }",
					"function third(request: RequestOptions, id: string) { return [request, id]; }",
					"function fourth(request: RequestOptions, id: string) { return [request, id]; }",
				].join("\n"),
				...ARBITRARY_COMBINATION_FILES,
			},
			(production_lint_configuration, options, mode) =>
				production_lint_configuration.lint_report(options, mode).report.violations,
		);
		const shared = violations.filter((violation) => violation.message().includes("share parameter"));
		const three_function_group = shared.filter((violation) => violation.file() === "three-functions.ts");
		const combination_group = shared.filter((violation) => violation.file() === "parameter-combination.ts");
		const combination_file_violations = shared.filter((violation) => violation.file() === "combinations.ts");
		const arbitrary_groups = combination_file_violations.filter((violation) =>
			violation.message().startsWith("multiple functions"),
		);
		const has_request_data = three_function_group.some((violation) =>
			violation.message().includes('parameter set "value:RequestData"'),
		);
		const has_request_combination = combination_group.some((violation) =>
			violation.message().includes('parameter set "id:string, request:RequestOptions"'),
		);
		const has_id_only = shared.some((violation) => violation.message().includes('parameter set "id:string"'));
		expect({
			three_function_count: three_function_group.length,
			has_request_data,
			combination_count: combination_group.length,
			has_request_combination,
			arbitrary_group_count: arbitrary_groups.length,
			has_id_only,
		}).toEqual({
			three_function_count: 1,
			has_request_data: true,
			combination_count: 2,
			has_request_combination: true,
			arbitrary_group_count: 5,
			has_id_only: true,
		});
	});

	test("keeps method scopes and source type identities separate", () => {
		const fixture = new TestFixture();
		const violations = fixture.with_lint_request(
			new LintRunConfiguration(new SourceText(), new NodeFileIO(process.cwd())),
			{
				"classes.ts": [
					"class SharedInput {}",
					"class FirstService {",
					"  first(value: SharedInput) { return value; }",
					"  second(value: SharedInput) { return value; }",
					"}",
					"class SecondService {",
					"  third(value: SharedInput) { return value; }",
					"  fourth(value: SharedInput) { return value; }",
					"}",
				].join("\n"),
				"first.ts": [
					"export class Request {}",
					"export function first(value: Request) { return value; }",
					"export function second(value: Request) { return value; }",
				].join("\n"),
				"second.ts": ["export class Request {}", "export function third(value: Request) { return value; }"].join("\n"),
				"third.ts": ["export class Request {}", "export function fourth(value: Request) { return value; }"].join("\n"),
			},
			(production_lint_configuration, options, mode) =>
				production_lint_configuration.lint_report(options, mode).report.violations,
		);
		const shared = violations.filter((violation) => violation.message().includes("share parameter"));

		expect(shared).toEqual([]);
	});

	test("reports repeated same-name primitive parameters within a class", () => {
		const fixture = new TestFixture();
		const violations = fixture.with_lint_request(
			new LintRunConfiguration(new SourceText(), new NodeFileIO(process.cwd())),
			{
				"source-text.ts": [
					"export class SourceText {",
					"  public source_text(file: string): string { return file; }",
					"  public source_available(file: string): boolean { return file.length > 0; }",
					"  public source_lines(file: string): string[] { return [file]; }",
					"}",
				].join("\n"),
			},
			(production_lint_configuration, options, mode) =>
				production_lint_configuration.lint_report(options, mode).report.violations,
		);
		const shared = violations.filter((violation) => violation.rule_id() === "shared-parameter");

		expect(shared.map((violation) => ({ file: violation.file(), message: violation.message() }))).toEqual([
			{
				file: "source-text.ts",
				message: expect.stringContaining('parameter set "file:string"'),
			},
		]);
	});

	test("includes Python Any, AST, generic, and union annotations", () => {
		const fixture = new TestFixture();
		const violations = fixture.with_lint_request(
			new LintRunConfiguration(new SourceText(), new NodeFileIO(process.cwd())),
			{
				"typed_values.py": [
					"import ast",
					"from typing import Any, Literal",
					"class ValueReader:",
					"    def first(self, value: Any, node: ast.AST, records: list[str], state: Literal['ready', 'done']) -> tuple[Any, ast.AST, list[str], Literal['ready', 'done']]:",
					"        return value, node, records, state",
					"    def second(self, value: Any, node: ast.AST, records: list[str], state: Literal['ready', 'done']) -> tuple[Any, ast.AST, list[str], Literal['ready', 'done']]:",
					"        return value, node, records, state",
					"    def third(self, value: Any, node: ast.AST, records: list[str], state: Literal['ready', 'done']) -> tuple[Any, ast.AST, list[str], Literal['ready', 'done']]:",
					"        return value, node, records, state",
				].join("\n"),
			},
			(production_lint_configuration, options, mode) =>
				production_lint_configuration.lint_report(options, mode).report.violations,
		);
		const messages = violations
			.filter((violation) => violation.rule_id() === "shared-parameter")
			.map((violation) => violation.message());

		expect({
			any_annotation: messages.some((message) => message.includes("value:Any")),
			ast_annotation: messages.some((message) => message.includes("node:ast.AST")),
			generic_annotation: messages.some((message) => message.includes("records:list[str]")),
			literal_union_annotation: messages.some((message) => message.includes("state:Literal['ready','done']")),
		}).toEqual({
			any_annotation: true,
			ast_annotation: true,
			generic_annotation: true,
			literal_union_annotation: true,
		});
	});

	test("includes every TypeScript annotation category in shared parameter diagnostics", () => {
		const fixture = new TestFixture();
		const violations = fixture.with_lint_request(
			new LintRunConfiguration(new SourceText(), new NodeFileIO(process.cwd())),
			{
				"typed-values.ts": [
					'import ts from "typescript";',
					"type RequestState = 'ready' | 'done';",
					"class RequestRecord { public readonly id: string = ''; }",
					"function first(primitive: string, loose: any, opaque: unknown, records: Map<string, unknown>, state: RequestState, source: ts.SourceFile, record: RequestRecord): readonly unknown[] { return [primitive, loose, opaque, records, state, source.fileName, record]; }",
					"function second(primitive: string, loose: any, opaque: unknown, records: Map<string, unknown>, state: RequestState, source: ts.SourceFile, record: RequestRecord): readonly unknown[] { return [primitive, loose, opaque, records, state, source.fileName, record]; }",
					"function third(primitive: string, loose: any, opaque: unknown, records: Map<string, unknown>, state: RequestState, source: ts.SourceFile, record: RequestRecord): readonly unknown[] { return [primitive, loose, opaque, records, state, source.fileName, record]; }",
				].join("\n"),
			},
			(production_lint_configuration, options, mode) =>
				production_lint_configuration.lint_report(options, mode).report.violations,
		);
		const messages = violations
			.filter((violation) => violation.rule_id() === "shared-parameter")
			.map((violation) => violation.message());
		const shared_message = messages.join("\n");

		expect({
			count: messages.length,
			primitive: shared_message.includes("primitive:string"),
			any: shared_message.includes("loose:any"),
			unknown: shared_message.includes("opaque:unknown"),
			collection: shared_message.includes("records:Map<string,unknown>"),
			literal_union: shared_message.includes("state:RequestState"),
			qualified: shared_message.includes("source:ts.SourceFile"),
			reference: shared_message.includes("record:RequestRecord"),
		}).toEqual({
			count: 8,
			primitive: true,
			any: true,
			unknown: true,
			collection: true,
			literal_union: true,
			qualified: true,
			reference: true,
		});
	});

	test("does not count constructors toward shared method parameters", () => {
		const fixture = new TestFixture();
		const violations = fixture.with_lint_request(
			new LintRunConfiguration(new SourceText(), new NodeFileIO(process.cwd())),
			{
				"constructor-parameters.ts": [
					"export class SourceText {",
					"  public constructor(file: string) {}",
					"  public source_text(file: string): string { return file; }",
					"  public source_available(file: string): boolean { return file.length > 0; }",
					"}",
				].join("\n"),
				"constructor_parameters.py": [
					"class SourceText:",
					"    def __init__(self, file: str) -> None:",
					"        self.file: str = file",
					"    def source_text(self, file: str) -> str:",
					"        return file",
					"    def source_available(self, file: str) -> bool:",
					"        return bool(file)",
				].join("\n"),
			},
			(production_lint_configuration, options, mode) =>
				production_lint_configuration.lint_report(options, mode).report.violations,
		);
		const shared = violations.filter((violation) => violation.rule_id() === "shared-parameter");

		expect(shared).toEqual([]);
	});

	test("counts private methods and matches parameter sets regardless of order", () => {
		const fixture = new TestFixture();
		const violations = fixture.with_lint_request(
			new LintRunConfiguration(new SourceText(), new NodeFileIO(process.cwd())),
			{
				"private-combination.ts": [
					"class TransferService {",
					"  public first(id: string, tab: string): string { return id + tab; }",
					"  public second(tab: string, id: string): string { return id + tab; }",
					"  private hidden(id: string, tab: string): string { return id + tab; }",
					"}",
				].join("\n"),
				"private_combination.py": [
					"class TransferService:",
					"    def first(self, id: str, tab: str) -> str:",
					"        return id + tab",
					"    def second(self, tab: str, id: str) -> str:",
					"        return id + tab",
					"    def _hidden(self, id: str, tab: str) -> str:",
					"        return id + tab",
				].join("\n"),
			},
			(production_lint_configuration, options, mode) =>
				production_lint_configuration.lint_report(options, mode).report.violations,
		);
		const combinations = violations
			.filter((violation) => violation.rule_id() === "shared-parameter")
			.filter(
				(violation) =>
					violation.message().includes('parameter set "id:string, tab:string"') ||
					violation.message().includes('parameter set "id:str, tab:str"'),
			)
			.map((violation) => ({ file: violation.file(), message: violation.message() }))
			.sort((left, right) => left.file.localeCompare(right.file));

		expect(combinations).toEqual([
			{
				file: "private_combination.py",
				message: expect.stringContaining('parameter set "id:str, tab:str"'),
			},
			{
				file: "private-combination.ts",
				message: expect.stringContaining('parameter set "id:string, tab:string"'),
			},
		]);
	});
});
