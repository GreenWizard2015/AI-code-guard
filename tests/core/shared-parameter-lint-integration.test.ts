import { describe, expect, test } from "@jest/globals";
import { LintRunConfiguration } from "src/core/lint_run_configuration";
import { SourceText } from "src/source_text";
import { NodeFileIO } from "src/io/node_file_io";
import { ARBITRARY_COMBINATION_FILES } from "tests/core/constants/ast_nodes/constants";
import { TestFixture } from "tests/core/test-fixture";

describe("shared parameter lint integration", () => {
	test("reports shared reference types and maximal parameter combinations", () => {
		const fixture = new TestFixture();
		const violations = fixture.with_lint_request(
			new LintRunConfiguration(new SourceText(), new NodeFileIO()),
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
		const shared = violations.filter((violation) => violation.message.includes("share parameter"));
		const three_function_group = shared.filter((violation) => violation.file === "three-functions.ts");
		const combination_group = shared.filter((violation) => violation.file === "parameter-combination.ts");
		const combination_file_violations = shared.filter((violation) => violation.file === "combinations.ts");
		const arbitrary_groups = combination_file_violations.filter((violation) =>
			violation.message.startsWith("multiple functions"),
		);
		const has_request_data = three_function_group.some((violation) =>
			violation.message.includes('parameter type "RequestData"'),
		);
		const has_request_combination = combination_group.some((violation) =>
			violation.message.includes('parameter combination "RequestOptions, id:string"'),
		);
		const has_id_only = shared.some((violation) => violation.message.includes('parameter type "id:string"'));
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
			arbitrary_group_count: 3,
			has_id_only: false,
		});
	});

	test("keeps method scopes and source type identities separate", () => {
		const fixture = new TestFixture();
		const violations = fixture.with_lint_request(
			new LintRunConfiguration(new SourceText(), new NodeFileIO()),
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
		const shared = violations.filter((violation) => violation.message.includes("share parameter"));

		expect(shared).toEqual([]);
	});
});
