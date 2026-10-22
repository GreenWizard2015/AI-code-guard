import { describe, expect, test } from "@jest/globals";
import { LintRunConfiguration } from "src/core/lint_run_configuration";
import { SourceText } from "src/source_text";
import { NodeFileIO } from "src/io/node_file_io";
import { TestFixture } from "tests/core/test-fixture";

describe("unused symbol rules", () => {
	test("reports unused TypeScript classes, constants, types, and public fields", () => {
		const fixture = new TestFixture();
		const files = {
			"source.ts": [
				"export class UnusedClass {}",
				"export class UsedClass {}",
				"export class FieldOwner {",
				"  public unused_field = 1;",
				"  public used_field = 2;",
				"}",
				"export const UNUSED_CONSTANT = 1;",
				"export const USED_CONSTANT = 2;",
				"let unused_state = 3;",
				"export type UnusedType = { value: string };",
				"export type UsedType = { value: string };",
			].join("\n"),
			"consumer.ts": [
				"import { FieldOwner, UsedClass, USED_CONSTANT, UsedType } from './source';",
				"const instance = new UsedClass();",
				"const owner = new FieldOwner();",
				"const value: UsedType = { value: String(USED_CONSTANT) };",
				"owner.used_field;",
				"instance;",
				"value;",
			].join("\n"),
		};
		const violations = fixture.with_lint_request(
			new LintRunConfiguration(new SourceText(), new NodeFileIO()),
			files,
			(production_lint_configuration, options, mode) =>
				production_lint_configuration.lint_report(options, mode).report.violations,
		);

		const rule_ids = violations
			.filter((violation) =>
				["unused-class", "unused-constant", "unused-module-variable", "unused-public-field", "unused-type"].includes(
					violation.rule_id,
				),
			)
			.map((violation) => violation.rule_id)
			.sort();
		const diagnostics = violations
			.filter((violation) => violation.rule_id.startsWith("unused-"))
			.map((violation) => `${violation.rule_id}:${violation.file}:${violation.line}:${violation.message}`)
			.sort();
		expect({ rule_ids, diagnostics, has_violations: violations.length > 0 }).toEqual({
			rule_ids: ["unused-class", "unused-constant", "unused-module-variable", "unused-public-field", "unused-type"],
			diagnostics: [
				'unused-class:source.ts:1:class "UnusedClass" has no production usage',
				'unused-constant:source.ts:7:module constant "UNUSED_CONSTANT" has no production usage',
				'unused-module-variable:source.ts:9:module variable "unused_state" has no production usage',
				'unused-public-field:source.ts:5:public field "unused_field" has no production usage',
				'unused-type:source.ts:10:type declaration "UnusedType" has no production usage',
			],
			has_violations: true,
		});
	});

	test("reports unused Python classes, constants, types, and public fields", () => {
		const fixture = new TestFixture();
		const files = {
			"source.py": [
				"from typing import TypeAlias",
				"class UnusedClass:",
				"    pass",
				"class UsedClass:",
				"    pass",
				"class FieldOwner:",
				"    unused_field: int = 1",
				"    _private_field: int = 2",
				"    used_field: int = 2",
				"",
				"    def read(self) -> int:",
				"        return self.used_field",
				"UNUSED_CONSTANT = 1",
				"USED_CONSTANT = 2",
				"unused_state = 3",
				"UnusedType: TypeAlias = str",
				"UsedType: TypeAlias = str",
			].join("\n"),
			"consumer.py": [
				"from source import FieldOwner, UsedClass, USED_CONSTANT, UsedType",
				"instance = UsedClass()",
				"owner = FieldOwner()",
				"value: UsedType = str(USED_CONSTANT)",
				"owner.used_field",
				"instance",
				"value",
			].join("\n"),
		};
		const violations = fixture.with_lint_request(
			new LintRunConfiguration(new SourceText(), new NodeFileIO()),
			files,
			(production_lint_configuration, options, mode) =>
				production_lint_configuration.lint_report(options, mode).report.violations,
		);

		const rule_ids = violations
			.filter((violation) =>
				["unused-class", "unused-constant", "unused-module-variable", "unused-public-field", "unused-type"].includes(
					violation.rule_id,
				),
			)
			.map((violation) => violation.rule_id)
			.sort();
		const diagnostics = violations
			.filter((violation) => violation.rule_id.startsWith("unused-"))
			.map((violation) => `${violation.rule_id}:${violation.file}:${violation.line}:${violation.message}`)
			.sort();
		expect({ rule_ids, diagnostics, has_violations: violations.length > 0 }).toEqual({
			rule_ids: ["unused-class", "unused-constant", "unused-module-variable", "unused-public-field", "unused-type"],
			diagnostics: [
				'unused-callable:source.py:11:method "FieldOwner.read" has insufficient production usage (found 0 other production files; candidate for removal/refactor)',
				'unused-class:source.py:2:class "UnusedClass" has no production usage',
				'unused-constant:source.py:13:module constant "UNUSED_CONSTANT" has no production usage',
				'unused-module-variable:source.py:15:module variable "unused_state" has no production usage',
				'unused-public-field:source.py:7:public field "unused_field" has no production usage',
				'unused-type:source.py:16:type declaration "UnusedType" has no production usage',
			],
			has_violations: true,
		});
	});

	test("treats Python __all__ as the module export declaration", () => {
		const fixture = new TestFixture();
		const violations = fixture.with_lint_request(
			new LintRunConfiguration(new SourceText(), new NodeFileIO()),
			{ "source.py": "__all__ = ['PublicContract']" },
			(production_lint_configuration, options, mode) =>
				production_lint_configuration.lint_report(options, mode).report.violations,
		);

		expect(violations.filter((item) => item.rule_id === "unused-module-variable")).toEqual([]);
	});

	test("does not count Python __all__ names as production API usage", () => {
		const fixture = new TestFixture();
		const violations = fixture.with_lint_request(
			new LintRunConfiguration(new SourceText(), new NodeFileIO()),
			{
				"source.py": ["class PublicService:", "    def run(self) -> int:", "        return 1"].join("\n"),
				"package/__init__.py": ["from source import PublicService", '__all__ = ["PublicService"]'].join("\n"),
			},
			(production_lint_configuration, options, mode) =>
				production_lint_configuration.lint_report(options, mode).report.violations,
		);

		expect(
			violations.filter((item) => item.rule_id === "unused-class").map((item) => `${item.file}:${item.message}`),
		).toEqual(['source.py:class "PublicService" has no production usage']);
	});

	test("propagates real usage through a Python __all__ re-export", () => {
		const fixture = new TestFixture();
		const violations = fixture.with_lint_request(
			new LintRunConfiguration(new SourceText(), new NodeFileIO()),
			{
				"source.py": ["class PublicService:", "    def run(self) -> int:", "        return 1"].join("\n"),
				"package/__init__.py": ["from source import PublicService", '__all__ = ["PublicService"]'].join("\n"),
				"consumer.py": ["from package import *", "service = PublicService()", "service.run()"].join("\n"),
			},
			(production_lint_configuration, options, mode) =>
				production_lint_configuration.lint_report(options, mode).report.violations,
		);

		expect(violations.filter((item) => item.rule_id === "unused-class")).toEqual([]);
	});

	test("does not report Python __slots__ as an unused public field", () => {
		const fixture = new TestFixture();
		const violations = fixture.with_lint_request(
			new LintRunConfiguration(new SourceText(), new NodeFileIO()),
			{
				"source.py": [
					"class SlotOwner:",
					"    __slots__ = ('value',)",
					"",
					"    def read(self) -> str:",
					"        return self.value",
				].join("\n"),
			},
			(production_lint_configuration, options, mode) =>
				production_lint_configuration.lint_report(options, mode).report.violations,
		);

		expect(violations.filter((violation) => violation.rule_id === "unused-public-field")).toEqual([]);
	});

	test("checks Python slot names as fields instead of checking __slots__ metadata", () => {
		const fixture = new TestFixture();
		const violations = fixture.with_lint_request(
			new LintRunConfiguration(new SourceText(), new NodeFileIO()),
			{
				"source.py": [
					"class SlotOwner:",
					"    __slots__ = ('unused_value',)",
					"    def read(self) -> int:",
					"        return 1",
				].join("\n"),
				"consumer.py": ["from source import SlotOwner", "owner = SlotOwner()", "owner.read()"].join("\n"),
			},
			(production_lint_configuration, options, mode) =>
				production_lint_configuration.lint_report(options, mode).report.violations,
		);

		expect(
			violations
				.filter((violation) => ["python-explicit-field-type", "unused-public-field"].includes(violation.rule_id))
				.map((violation) => `${violation.rule_id}:${violation.file}:${violation.line}:${violation.message}`)
				.sort(),
		).toEqual([
			'python-explicit-field-type:source.py:2:Python field "unused_value" is missing an explicit type',
			'unused-public-field:source.py:2:public field "unused_value" has no production usage',
		]);
	});

	test("resolves aliased slots and accepts annotated string slots", () => {
		const fixture = new TestFixture();
		const violations = fixture.with_lint_request(
			new LintRunConfiguration(new SourceText(), new NodeFileIO()),
			{
				"source.py": [
					"MODULE_SLOT_NAMES: tuple[str, ...] = ('unused_module_value',)",
					"",
					"class ModuleAliasSlotOwner:",
					"    __slots__ = MODULE_SLOT_NAMES",
					"    def read(self) -> int:",
					"        return 1",
					"",
					"class AliasSlotOwner:",
					"    __slot_names: tuple[str, ...] = ('unused_value',)",
					"    __slots__ = __slot_names",
					"    def read(self) -> int:",
					"        return 1",
					"",
					"class StringSlotOwner:",
					"    __slots__ = 'used_value'",
					"    used_value: str",
					"    def __init__(self) -> None:",
					"        self.used_value = 'value'",
					"    def read(self) -> str:",
					"        return self.used_value",
					"",
					"class ListSlotOwner:",
					"    __slots__ = ['unused_list_value']",
					"    def read(self) -> int:",
					"        return 1",
					"",
					"class SetSlotOwner:",
					"    __slots__ = {'unused_set_value'}",
					"    def read(self) -> int:",
					"        return 1",
					"",
					"class MappingSlotOwner:",
					"    __slots__ = {'unused_mapping_value': 'description'}",
					"    def read(self) -> int:",
					"        return 1",
				].join("\n"),
				"consumer.py": [
					"from source import AliasSlotOwner, ListSlotOwner, MappingSlotOwner, ModuleAliasSlotOwner, SetSlotOwner, StringSlotOwner",
					"alias_owner = AliasSlotOwner()",
					"list_owner = ListSlotOwner()",
					"mapping_owner = MappingSlotOwner()",
					"module_alias_owner = ModuleAliasSlotOwner()",
					"set_owner = SetSlotOwner()",
					"string_owner = StringSlotOwner()",
					"alias_owner.read()",
					"list_owner.read()",
					"mapping_owner.read()",
					"module_alias_owner.read()",
					"set_owner.read()",
					"string_owner.read()",
				].join("\n"),
			},
			(production_lint_configuration, options, mode) =>
				production_lint_configuration.lint_report(options, mode).report.violations,
		);

		expect(
			violations
				.filter((violation) => ["python-explicit-field-type", "unused-public-field"].includes(violation.rule_id))
				.map((violation) => `${violation.rule_id}:${violation.file}:${violation.message}`)
				.sort(),
		).toEqual([
			'python-explicit-field-type:source.py:Python field "unused_list_value" is missing an explicit type',
			'python-explicit-field-type:source.py:Python field "unused_mapping_value" is missing an explicit type',
			'python-explicit-field-type:source.py:Python field "unused_module_value" is missing an explicit type',
			'python-explicit-field-type:source.py:Python field "unused_set_value" is missing an explicit type',
			'python-explicit-field-type:source.py:Python field "unused_value" is missing an explicit type',
			'unused-public-field:source.py:public field "unused_list_value" has no production usage',
			'unused-public-field:source.py:public field "unused_mapping_value" has no production usage',
			'unused-public-field:source.py:public field "unused_module_value" has no production usage',
			'unused-public-field:source.py:public field "unused_set_value" has no production usage',
			'unused-public-field:source.py:public field "unused_value" has no production usage',
		]);
	});

	test("does not report Python class variables that configure a base class", () => {
		const fixture = new TestFixture();
		const violations = fixture.with_lint_request(
			new LintRunConfiguration(new SourceText(), new NodeFileIO()),
			{
				"source.py": [
					"class FrameworkBase:",
					"    pass",
					"class Handler(FrameworkBase):",
					"    version_name: str = 'Proxy/1.0'",
					"class LocalOwner:",
					"    unused_value: str = 'unused'",
					"    def read(self) -> int:",
					"        return 1",
				].join("\n"),
			},
			(production_lint_configuration, options, mode) =>
				production_lint_configuration.lint_report(options, mode).report.violations,
		);

		expect(
			violations
				.filter((violation) => violation.rule_id === "unused-public-field")
				.map((violation) => `${violation.file}:${violation.message}`),
		).toEqual(['source.py:public field "unused_value" has no production usage']);
	});

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
			new LintRunConfiguration(new SourceText(), new NodeFileIO()),
			files,
			(production_lint_configuration, options, mode) =>
				production_lint_configuration.lint_report(options, mode).report.violations,
		);

		expect(
			violations
				.filter((violation) => violation.rule_id === "unused-public-field")
				.map((violation) => `${violation.file}:${violation.line}:${violation.message}`)
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
			new LintRunConfiguration(new SourceText(), new NodeFileIO()),
			files,
			(production_lint_configuration, options, mode) =>
				production_lint_configuration.lint_report(options, mode).report.violations,
		);
		const test_only = violations.filter((violation) => violation.rule_id === "test-only-usage");
		expect(test_only).toHaveLength(2);
		expect(violations.filter((violation) => violation.rule_id === "unused-public-field")).toHaveLength(0);
	});

	test("does not let an unrelated same-name local reference hide a declaration", () => {
		const fixture = new TestFixture();
		const files = {
			"dead.ts": "export class Widget {}\n",
			"other.ts": "export function read(Widget: number): number { return Widget; }\n",
		};
		const violations = fixture.with_lint_request(
			new LintRunConfiguration(new SourceText(), new NodeFileIO()),
			files,
			(production_lint_configuration, options, mode) =>
				production_lint_configuration.lint_report(options, mode).report.violations,
		);

		expect(violations.filter((violation) => violation.rule_id === "unused-class")).toEqual([
			expect.objectContaining({
				file: "dead.ts",
				message: 'class "Widget" has no production usage',
			}),
		]);
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
			new LintRunConfiguration(new SourceText(), new NodeFileIO()),
			files,
			(production_lint_configuration, options, mode) =>
				production_lint_configuration.lint_report(options, mode).report.violations,
		);

		expect({
			used: violations.some((item) => item.message.includes('constant "USED_VALUE"')),
			unused: violations.filter((item) => item.rule_id === "unused-constant").length,
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
			new LintRunConfiguration(new SourceText(), new NodeFileIO()),
			files,
			(production_lint_configuration, options, mode) =>
				production_lint_configuration.lint_report(options, mode).report.violations,
		);

		expect(violations.filter((item) => item.rule_id === "unused-class")).toEqual([
			expect.objectContaining({ file: "dead.ts", message: 'class "Widget" has no production usage' }),
		]);
	});

	test("does not share field usage between unrelated classes", () => {
		const fixture = new TestFixture();
		const files = {
			"dead.ts": "export class Dead { public value = 1; }\n",
			"other.ts": "export function read(value: { value: number }): number { return value.value; }\n",
		};
		const violations = fixture.with_lint_request(
			new LintRunConfiguration(new SourceText(), new NodeFileIO()),
			files,
			(production_lint_configuration, options, mode) =>
				production_lint_configuration.lint_report(options, mode).report.violations,
		);

		expect(violations.filter((item) => item.rule_id === "unused-public-field")).toEqual([
			expect.objectContaining({ file: "dead.ts", message: 'public field "value" has no production usage' }),
		]);
	});
});
