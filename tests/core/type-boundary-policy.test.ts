import { describe, expect, test } from "@jest/globals";
import { LintRunConfiguration } from "src/core/lint_run_configuration";
import { SourceText } from "src/source_text";
import { NodeFileIO } from "src/io/node_file_io";
import { PROTOCOL_REFERENCE_FILES } from "tests/core/constants/ast_nodes/constants";
import { TestFixture } from "tests/core/test-fixture";

describe("type boundary policies", () => {
	test("reports nested types, unsafe field mutation, and missing visibility", () => {
		const fixture = new TestFixture();
		const violations = fixture.with_lint_request(
			new LintRunConfiguration(new SourceText(), new NodeFileIO()),
			{
				"inline-generics.ts": [
					"type Result = Promise<{ id: string; value: number }>;",
					"type Items = Array<{ id: string }>;;",
					"type Wrapped = Promise<({ id: string })>;",
				].join("\n"),
				"inline-generics.py": ["def load(items: list[dict[str, int]]) -> None:", "    pass"].join("\n"),
				"nested-return.py": ["def read_rows(source: str) -> list[dict[str, str]]:", "    return []"].join("\n"),
				...PROTOCOL_REFERENCE_FILES,
				"mutable.ts": [
					"class Service {",
					"  value = 0;",
					"  constructor() { this.value = 1; }",
					"  update() { this.value = 2; }",
					"}",
				].join("\n"),
				"mutable-computed.ts": [
					"class Service {",
					"  private value: number = 0;",
					"  update(next: number) {",
					"    this['value'] = next;",
					"    const field_name = 'value';",
					"    this[field_name] = next;",
					"  }",
					"}",
				].join("\n"),
				"visibility.ts": [
					"class Service {",
					"  value = 0;",
					"  run() { return this.value; }",
					"  private hidden() {}",
					"}",
				].join("\n"),
				"accessors.ts": [
					"class Account {",
					'  get name(): string { return "account"; }',
					"  set name(value: string) { void value; }",
					"}",
				].join("\n"),
				"tests/visibility.test.ts": ["class TestService {", "  value = 0;", "  run() { return this.value; }", "}"].join(
					"\n",
				),
				"object.ts": ["function create_tools() {", "  return {", "    run() { return true; },", "  };", "}"].join("\n"),
				"mutable-fields.ts": ["class Service {", "  public value = 0;", "  public readonly stable = 1;", "}"].join(
					"\n",
				),
			},
			(production_lint_configuration, options, mode) =>
				production_lint_configuration.lint_report(options, mode).report.violations,
		);
		const diagnostics = {
			inline_generic_files: violations
				.filter((violation) => violation.message === "avoid inline object types in generic arguments")
				.map((violation) => violation.file),
			nested_return: violations.some(
				(violation) => violation.file === "nested-return.py" && violation.rule_id === "inline-generic-type",
			),
			mutation_files: violations
				.filter((violation) => violation.message === "avoid assigning class fields outside constructors")
				.map((violation) => violation.file),
			visibility_files: violations
				.filter((violation) => violation.message === "class members must declare visibility explicitly")
				.map((violation) => violation.file),
			readonly_files: violations
				.filter((violation) => violation.message === "TypeScript class fields should be readonly")
				.map((violation) => violation.file),
			contract_boundary_files: violations
				.filter((violation) => violation.message === 'class "ServicePort" has implementation type at boundary')
				.map((violation) => violation.file),
			test_visibility_reported: violations.some(
				(violation) =>
					violation.message === "class members must declare visibility explicitly" &&
					violation.file === "tests/visibility.test.ts",
			),
		};

		expect(diagnostics).toEqual({
			inline_generic_files: expect.arrayContaining(["inline-generics.ts", "inline-generics.py"]),
			nested_return: true,
			mutation_files: expect.arrayContaining(["mutable.ts", "mutable-computed.ts"]),
			visibility_files: expect.arrayContaining(["visibility.ts", "accessors.ts"]),
			readonly_files: expect.arrayContaining([
				"mutable.ts",
				"mutable-computed.ts",
				"visibility.ts",
				"mutable-fields.ts",
			]),
			contract_boundary_files: [],
			test_visibility_reported: false,
		});
	});

	test("allows interface references and object literals with behavior", () => {
		const fixture = new TestFixture();
		const violations = fixture.with_lint_request(
			new LintRunConfiguration(new SourceText(), new NodeFileIO()),
			{
				"ports.ts": "export interface ServicePort { run(): void; }",
				"consumer.ts": [
					"import type { ServicePort } from './ports';",
					"export class Consumer {",
					"  constructor(private readonly service: ServicePort) {}",
					"}",
				].join("\n"),
				"object.ts": ["function create_tools() {", "  return { run() { return true; } };", "}"].join("\n"),
			},
			(production_lint_configuration, options, mode) =>
				production_lint_configuration.lint_report(options, mode).report.violations,
		);
		const rejected = [
			"avoid inline object types in generic arguments",
			"avoid nested generic types",
			"avoid assigning class fields outside constructors",
			"class members must declare visibility explicitly",
			"TypeScript class fields should be readonly",
		];

		expect(violations.filter((violation) => rejected.includes(violation.message))).toEqual([]);
	});
});
