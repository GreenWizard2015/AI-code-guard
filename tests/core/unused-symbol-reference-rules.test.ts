import { describe, expect, test } from "@jest/globals";
import { LintRunConfiguration } from "src/core/lint_run_configuration";
import { NodeFileIO } from "src/io/node_file_io";
import { SourceText } from "src/io/source_text";
import { TestFixture } from "tests/core/test-fixture";

describe("unused symbol references", () => {
	test("reports unused fields declared by TypeScript types and interfaces", () => {
		const fixture = new TestFixture();
		const files = {
			"contracts.ts": [
				"export type UnusedType = {",
				"  unused_type_field: string;",
				"};",
				"export interface UnusedInterface {",
				"  unused_interface_field: string;",
				"}",
				"export interface UsedInterface {",
				"  used_interface_field: string;",
				"}",
			].join("\n"),
			"consumer.ts": [
				"import type { UsedInterface } from './contracts';",
				"const value: UsedInterface = { used_interface_field: 'value' };",
				"value.used_interface_field;",
			].join("\n"),
		};
		const violations = fixture.with_lint_request(
			new LintRunConfiguration(new SourceText(), new NodeFileIO(process.cwd())),
			files,
			(production_lint_configuration, options, mode) =>
				production_lint_configuration.lint_report(options, mode).report.violations,
		);

		expect(
			violations
				.filter((violation) => violation.rule_id() === "unused-public-field")
				.map((violation) => `${violation.file()}:${violation.line()}:${violation.message()}`)
				.sort(),
		).toEqual([
			'contracts.ts:2:public field "unused_type_field" has no production usage',
			'contracts.ts:5:public field "unused_interface_field" has no production usage',
		]);
	});
	test("reports public fields referenced only by tests in both languages", () => {
		const fixture = new TestFixture();
		const files = {
			"source.ts": "export class Service { public value = 1; }",
			"tests/service.test.ts": "import { Service } from '../source'; const service = new Service(); service.value;",
			"source.py": "class Service:\n    value: int = 1\n    def read(self) -> int:\n        return 0",
			"tests/test_service.py": "from source import Service\nservice = Service()\nservice.value",
		};
		const violations = fixture.with_lint_request(
			new LintRunConfiguration(new SourceText(), new NodeFileIO(process.cwd())),
			files,
			(production_lint_configuration, options, mode) =>
				production_lint_configuration.lint_report(options, mode).report.violations,
		);
		const test_only = violations.filter((violation) => violation.rule_id() === "test-only-usage");
		expect(test_only).toHaveLength(2);
		expect(violations.filter((violation) => violation.rule_id() === "unused-public-field")).toHaveLength(0);
	});

	test("does not let an unrelated same-name local reference hide a declaration", () => {
		const fixture = new TestFixture();
		const files = {
			"dead.ts": "export class Widget {}\n",
			"other.ts": "export function read(Widget: number): number { return Widget; }\n",
		};
		const violations = fixture.with_lint_request(
			new LintRunConfiguration(new SourceText(), new NodeFileIO(process.cwd())),
			files,
			(production_lint_configuration, options, mode) =>
				production_lint_configuration.lint_report(options, mode).report.violations,
		);

		expect(
			violations
				.filter((violation) => violation.rule_id() === "unused-class")
				.map((violation) => ({ file: violation.file(), message: violation.message() })),
		).toEqual([{ file: "dead.ts", message: 'class "Widget" has no production usage' }]);
	});

	test("keeps imported symbol usage scoped to matching definition names", () => {
		const fixture = new TestFixture();
		const definitions = Array.from({ length: 40 }, (_, index) => `export const UNUSED_${index} = ${index};`);
		const files = {
			"definitions.ts": definitions.concat("export const USED_VALUE = 1;").join("\n"),
			"consumer.ts": ["import { USED_VALUE } from './definitions';", "const result = USED_VALUE;", "void result;"].join(
				"\n",
			),
		};
		const violations = fixture.with_lint_request(
			new LintRunConfiguration(new SourceText(), new NodeFileIO(process.cwd())),
			files,
			(production_lint_configuration, options, mode) =>
				production_lint_configuration.lint_report(options, mode).report.violations,
		);

		expect({
			used: violations.some((item) => item.message().includes('constant "USED_VALUE"')),
			unused: violations.filter((item) => item.rule_id() === "unused-constant").length,
		}).toEqual({ used: false, unused: 40 });
	});

	test("does not let a parameter shadowing a class hide its unused diagnostic", () => {
		const fixture = new TestFixture();
		const files = {
			"dead.ts": "export class Widget {}\nexport const LIVE = 1;\n",
			"use.ts": [
				"import { LIVE } from './dead';",
				"export function read(Widget: number): number { return Widget + LIVE; }",
			].join("\n"),
		};
		const violations = fixture.with_lint_request(
			new LintRunConfiguration(new SourceText(), new NodeFileIO(process.cwd())),
			files,
			(production_lint_configuration, options, mode) =>
				production_lint_configuration.lint_report(options, mode).report.violations,
		);

		expect(
			violations
				.filter((item) => item.rule_id() === "unused-class")
				.map((item) => ({ file: item.file(), message: item.message() })),
		).toEqual([{ file: "dead.ts", message: 'class "Widget" has no production usage' }]);
	});

	test("includes nested function parameters in shadow intervals", () => {
		const fixture = new TestFixture();
		const files = {
			"dead.ts": "export class Widget {}\nexport const LIVE = 1;\n",
			"use.ts": [
				"import { LIVE } from './dead';",
				"export function read(): number {",
				"  const nested = (Widget: number): number => Widget;",
				"  return nested(1) + LIVE;",
				"}",
			].join("\n"),
		};
		const violations = fixture.with_lint_request(
			new LintRunConfiguration(new SourceText(), new NodeFileIO(process.cwd())),
			files,
			(production_lint_configuration, options, mode) =>
				production_lint_configuration.lint_report(options, mode).report.violations,
		);

		expect(violations.filter((item) => item.rule_id() === "unused-class").map((item) => item.file())).toEqual([
			"dead.ts",
		]);
	});

	test("matches repeated parameter names across disjoint function intervals", () => {
		const fixture = new TestFixture();
		const functions = Array.from(
			{ length: 80 },
			(_, index) => `export function shadow_${index}(Widget: number): number { return Widget; }`,
		).join("\n\n");
		const files = {
			"dead.ts": `export class Widget {}\nexport const LIVE = 1;\n${functions}\n`,
			"use.ts": "import { LIVE } from './dead'; export const used = LIVE;\n",
		};
		const violations = fixture.with_lint_request(
			new LintRunConfiguration(new SourceText(), new NodeFileIO(process.cwd())),
			files,
			(production_lint_configuration, options, mode) =>
				production_lint_configuration.lint_report(options, mode).report.violations,
		);

		expect(violations.filter((item) => item.rule_id() === "unused-class").map((item) => item.file())).toEqual([
			"dead.ts",
		]);
	});

	test("does not share field usage between unrelated classes", () => {
		const fixture = new TestFixture();
		const files = {
			"dead.ts": "export class Dead { public value = 1; }\n",
			"other.ts": "export function read(value: { value: number }): number { return value.value; }\n",
		};
		const violations = fixture.with_lint_request(
			new LintRunConfiguration(new SourceText(), new NodeFileIO(process.cwd())),
			files,
			(production_lint_configuration, options, mode) =>
				production_lint_configuration.lint_report(options, mode).report.violations,
		);

		expect(
			violations
				.filter((item) => item.rule_id() === "unused-public-field")
				.map((item) => ({ file: item.file(), message: item.message() })),
		).toEqual([{ file: "dead.ts", message: 'public field "value" has no production usage' }]);
	});
});
