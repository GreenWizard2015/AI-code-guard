import { describe, expect, test } from "@jest/globals";
import { LintRunConfiguration } from "src/core/lint_run_configuration";
import { NodeFileIO } from "src/io/node_file_io";
import { SourceText } from "src/io/source_text";
import { TestFixture } from "tests/core/test-fixture";

describe("TypeScript state access analysis", () => {
	const files: Record<string, string> = {
		"constructor-if.ts": [
			"class Consumer {",
			"  private readonly value: string;",
			"  constructor(value: string) {",
			"    if (!value) {",
			'      throw new Error("value required");',
			"    }",
			"    this.value = value;",
			"  }",
			"}",
		].join("\n"),
		"mutable-alias.ts": [
			"class Service {",
			"  value = 0;",
			"  update() {",
			"    const first = this;",
			"    const second = first;",
			"    second.value = 1;",
			"    let third: Service;",
			"    third = second;",
			"    third.value = 2;",
			"  }",
			"}",
		].join("\n"),
		"required-field-check.ts": [
			"type Parsed = { attribute_accesses: string[] };",
			"function has_attributes(parsed: Parsed): boolean {",
			"  return parsed['attribute_accesses'] === undefined;",
			"}",
			"function has_optional_attributes(parsed: Parsed): boolean {",
			'  return parsed?.[ ("attribute_accesses") ].length > 0;',
			"}",
		].join("\n"),
		"array-alias.ts": [
			"type Service = { value: string };",
			"function find_service(): Service[] { return []; }",
			"const services = find_service();",
			"const array_service = services[0];",
			"function find_wrapped_service(): Service[] { return ([]); }",
			"const wrapped_service = find_wrapped_service()[0];",
			"const parenthesized_service = (find_service())[0];",
			"const [aliased_find_service] = [find_service];",
			"const destructured_service = aliased_find_service()[0];",
		].join("\n"),
		"nested-array.ts": [
			'function make_items(): string[] { return ["item"]; }',
			"function read_nested(): string {",
			'\tconst make_nested = (): string[] => ["item"];',
			"\treturn make_nested().at(0);",
			"}",
			"const control = make_items().at(0);",
		].join("\n"),
		"bound-callback.ts": [
			"const callback = service.run.bind(service);",
			"const wrapped_callback = (service.run.bind)(service);",
			"const asserted_callback = (service.run.bind as typeof service.run.bind)(service);",
			"const bound_callback = service.run.bind;",
			"bound_callback(service);",
			'const method_name = "bind";',
			"service.run[method_name](service);",
		].join("\n"),
		"private.ts": [
			"class Sample {",
			"  private secret() {}",
			"  inside() { this.secret(); }",
			"}",
			"const sample = new Sample();",
			"sample.secret();",
		].join("\n"),
		"private-alias.ts": [
			"class Sample {",
			"  private secret = 1;",
			"}",
			"const sample = new Sample();",
			"const alias = sample;",
			"alias.secret;",
			'alias["secret"];',
		].join("\n"),
		"private-element-access.ts": [
			"class Sample {",
			"  private secret() {}",
			'  inside() { this["secret"](); }',
			"}",
			"const sample = new Sample();",
			"sample.secret();",
			'sample["secret"]();',
			"sample[`secret`]();",
			'sample[("secret")]();',
		].join("\n"),
	};
	test("analyzes constructor, field, undefined, and array access cases", () => {
		const fixture = new TestFixture();
		const violations = fixture.with_lint_request(
			new LintRunConfiguration(new SourceText(), new NodeFileIO(process.cwd())),
			Object.fromEntries(
				Object.entries(files).filter(([file]) =>
					[
						"constructor-if.ts",
						"mutable-alias.ts",
						"required-field-check.ts",
						"array-alias.ts",
						"nested-array.ts",
					].includes(file),
				),
			),
			(production_lint_configuration, options, mode) =>
				production_lint_configuration.lint_report(options, mode).report.violations,
		);

		expect({
			constructor_work: violations
				.filter((item) => item.message() === "keep constructors limited to setup and validation")
				.map((item) => `${item.file()}:${item.line()}`)
				.sort(),
			field_mutations: violations
				.filter((item) => item.rule_id() === "object-field-write")
				.map((item) => `${item.file()}:${item.line()}`)
				.sort(),
			undefined_checks: violations
				.filter((item) => item.rule_id() === "unnecessary-undefined-check")
				.map((item) => `${item.file()}:${item.line()}`)
				.sort(),
			array_access: violations
				.filter((item) => item.rule_id() === "single-item-array-state")
				.map((item) => `${item.file()}:${item.line()}`)
				.sort(),
		}).toEqual({
			constructor_work: [],
			field_mutations: ["constructor-if.ts:7", "mutable-alias.ts:6", "mutable-alias.ts:9"],
			undefined_checks: ["required-field-check.ts:3", "required-field-check.ts:6"],
			array_access: [
				"array-alias.ts:4",
				"array-alias.ts:6",
				"array-alias.ts:7",
				"array-alias.ts:8",
				"array-alias.ts:9",
				"nested-array.ts:4",
				"nested-array.ts:6",
			],
		});
	});

	test("analyzes bound callbacks and private access cases", () => {
		const fixture = new TestFixture();
		const violations = fixture.with_lint_request(
			new LintRunConfiguration(new SourceText(), new NodeFileIO(process.cwd())),
			Object.fromEntries(
				Object.entries(files).filter(([file]) =>
					["bound-callback.ts", "private.ts", "private-alias.ts", "private-element-access.ts"].includes(file),
				),
			),
			(production_lint_configuration, options, mode) =>
				production_lint_configuration.lint_report(options, mode).report.violations,
		);

		expect(
			violations
				.filter((item) => item.message() === "avoid .bind calls")
				.map((item) => `${item.file()}:${item.line()}`)
				.sort(),
		).toEqual([
			"bound-callback.ts:1",
			"bound-callback.ts:2",
			"bound-callback.ts:3",
			"bound-callback.ts:5",
			"bound-callback.ts:7",
		]);
		expect(
			violations
				.filter((item) => item.message() === "private class members must not be accessed from outside their class")
				.map((item) => `${item.file()}:${item.line()}`)
				.sort(),
		).toEqual([
			"private-alias.ts:6",
			"private-alias.ts:7",
			"private-element-access.ts:6",
			"private-element-access.ts:7",
			"private-element-access.ts:8",
			"private-element-access.ts:9",
			"private.ts:6",
		]);
	});
});
