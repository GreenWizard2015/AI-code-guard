import { describe, expect, test } from "@jest/globals";
import { LintRunConfiguration } from "src/core/lint_run_configuration";
import { NodeFileIO } from "src/io/node_file_io";
import { SourceText } from "src/io/source_text";
import { InMemoryFileIO } from "tests/bridge/ts/core/cache/in_memory_file_io";
import { TestFixture } from "tests/core/test-fixture";

describe("unused symbol rules", () => {
	test("counts inherited abstract method dispatch as usage of concrete overrides", () => {
		const fixture = new TestFixture();
		const violations = fixture.with_lint_request(
			new LintRunConfiguration(new SourceText(), new InMemoryFileIO()),
			{
				"src/base_rule.ts": [
					"export abstract class BaseRule {",
					"  protected abstract collect(): string[];",
					"  protected grouped(): string[][] {",
					"    return [this.collect()];",
					"  }",
					"}",
				].join("\n"),
				"src/first_rule.ts": [
					"import { BaseRule } from './base_rule';",
					"export class FirstRule extends BaseRule { protected collect(): string[] { return []; } }",
				].join("\n"),
				"src/second_rule.ts": [
					"import { BaseRule } from './base_rule';",
					"export class SecondRule extends BaseRule { protected collect(): string[] { return []; } }",
				].join("\n"),
				"src/third_rule.ts": [
					"import { BaseRule } from './base_rule';",
					"export class ThirdRule extends BaseRule { protected collect(): string[] { return []; } }",
				].join("\n"),
				"src/fourth_rule.ts": [
					"import { BaseRule } from './base_rule';",
					"export class FourthRule extends BaseRule { protected collect(): string[] { return []; } }",
				].join("\n"),
			},
			(production_lint_configuration, options, mode) =>
				production_lint_configuration.lint_report(options, mode).report.violations,
		);

		expect(
			violations
				.filter((item) => item.rule_id() === "unused-callable" && item.message().includes(".collect"))
				.map((item) => item.file()),
		).toEqual([]);
	});

	test("reports unused TypeScript and Python declarations by language", () => {
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
			new LintRunConfiguration(new SourceText(), new NodeFileIO(process.cwd())),
			files,
			(production_lint_configuration, options, mode) =>
				production_lint_configuration.lint_report(options, mode).report.violations,
		);

		/** Responsibilities: _unused symbol rule lookup_. **/
		const rule_ids_for = (file: string): string[] =>
			violations
				.filter((violation) => violation.file() === file)
				.map((violation) => violation.rule_id())
				.filter((rule_id) =>
					["unused-class", "unused-constant", "unused-module-variable", "unused-public-field", "unused-type"].includes(
						rule_id,
					),
				)
				.sort();
		const diagnostics = violations
			.filter((violation) =>
				[
					"unused-class",
					"unused-constant",
					"unused-module-variable",
					"unused-public-field",
					"unused-type",
					"unused-callable",
				].includes(violation.rule_id()),
			)
			.map((violation) => `${violation.rule_id()}:${violation.file()}:${violation.line()}:${violation.message()}`)
			.sort();
		const expected_rule_ids = [
			"unused-class",
			"unused-constant",
			"unused-module-variable",
			"unused-public-field",
			"unused-type",
		];
		expect({
			typescript_rule_ids: rule_ids_for("source.ts"),
			python_rule_ids: rule_ids_for("source.py"),
			diagnostics,
			has_violations: violations.length > 0,
		}).toEqual({
			typescript_rule_ids: expected_rule_ids,
			python_rule_ids: expected_rule_ids,
			diagnostics: [
				'unused-callable:source.py:11:method "FieldOwner.read" has insufficient production usage (found 0 other production files; candidate for removal/refactor)',
				'unused-class:source.py:2:class "UnusedClass" has no production usage',
				'unused-class:source.ts:1:class "UnusedClass" has no production usage',
				'unused-constant:source.py:13:module constant "UNUSED_CONSTANT" has no production usage',
				'unused-constant:source.ts:7:module constant "UNUSED_CONSTANT" has no production usage',
				'unused-module-variable:source.py:15:module variable "unused_state" has no production usage',
				'unused-module-variable:source.ts:9:module variable "unused_state" has no production usage',
				'unused-public-field:source.py:7:public field "unused_field" has no production usage',
				'unused-public-field:source.ts:5:public field "unused_field" has no production usage',
				'unused-type:source.py:16:type declaration "UnusedType" has no production usage',
				'unused-type:source.ts:10:type declaration "UnusedType" has no production usage',
			].sort(),
			has_violations: true,
		});
	});

	test("resolves TypeScript type usage through named and cyclic star re-exports", () => {
		const fixture = new TestFixture();
		const violations = fixture.with_lint_request(
			new LintRunConfiguration(new SourceText(), new InMemoryFileIO()),
			{
				"src/types/shape.ts": [
					"export type Shape = { value: string };",
					"export type UnusedShape = { other: number };",
				].join("\n"),
				"src/types/model.ts": 'export type { Shape as PublicShape } from "./shape";',
				"src/types/index.ts": ['export * from "./model";', 'export * from "./cycle";'].join("\n"),
				"src/types/cycle.ts": 'export * from "./index";',
				"src/consumer.ts": [
					'import type { PublicShape } from "./types";',
					'const value: PublicShape = { value: "ready" };',
					"value;",
				].join("\n"),
			},
			(production_lint_configuration, options, mode) =>
				production_lint_configuration.lint_report(options, mode).report.violations,
		);

		expect(
			violations
				.filter((violation) => violation.rule_id() === "unused-type")
				.map((violation) => `${violation.file()}:${violation.message()}`),
		).toEqual(['src/types/shape.ts:type declaration "UnusedShape" has no production usage']);
	});

	test("treats Python __all__ as the module export declaration", () => {
		const fixture = new TestFixture();
		const violations = fixture.with_lint_request(
			new LintRunConfiguration(new SourceText(), new NodeFileIO(process.cwd())),
			{ "source.py": "__all__ = ['PublicContract']" },
			(production_lint_configuration, options, mode) =>
				production_lint_configuration.lint_report(options, mode).report.violations,
		);

		expect(violations.filter((item) => item.rule_id() === "unused-module-variable")).toEqual([]);
	});

	test("does not count Python __all__ names as production API usage", () => {
		const fixture = new TestFixture();
		const violations = fixture.with_lint_request(
			new LintRunConfiguration(new SourceText(), new NodeFileIO(process.cwd())),
			{
				"source.py": ["class PublicService:", "    def run(self) -> int:", "        return 1"].join("\n"),
				"package/__init__.py": ["from source import PublicService", '__all__ = ["PublicService"]'].join("\n"),
			},
			(production_lint_configuration, options, mode) =>
				production_lint_configuration.lint_report(options, mode).report.violations,
		);

		expect(
			violations.filter((item) => item.rule_id() === "unused-class").map((item) => `${item.file()}:${item.message()}`),
		).toEqual(['source.py:class "PublicService" has no production usage']);
	});

	test("propagates real usage through a Python __all__ re-export", () => {
		const fixture = new TestFixture();
		const violations = fixture.with_lint_request(
			new LintRunConfiguration(new SourceText(), new NodeFileIO(process.cwd())),
			{
				"source.py": ["class PublicService:", "    def run(self) -> int:", "        return 1"].join("\n"),
				"package/__init__.py": ["from source import PublicService", '__all__ = ["PublicService"]'].join("\n"),
				"consumer.py": ["from package import *", "service = PublicService()", "service.run()"].join("\n"),
			},
			(production_lint_configuration, options, mode) =>
				production_lint_configuration.lint_report(options, mode).report.violations,
		);

		expect(violations.filter((item) => item.rule_id() === "unused-class")).toEqual([]);
	});

	test("resolves a used symbol through a cyclic Python re-export chain", () => {
		const fixture = new TestFixture();
		const violations = fixture.with_lint_request(
			new LintRunConfiguration(new SourceText(), new NodeFileIO(process.cwd())),
			{
				"source.py": ["class PublicService:", "    def run(self) -> int:", "        return 1"].join("\n"),
				"first.py": [
					"from second import PublicService",
					"from source import PublicService",
					'__all__ = ["PublicService"]',
				].join("\n"),
				"second.py": ["from first import PublicService", '__all__ = ["PublicService"]'].join("\n"),
				"consumer.py": ["from first import PublicService", "PublicService()"].join("\n"),
			},
			(production_lint_configuration, options, mode) =>
				production_lint_configuration.lint_report(options, mode).report.violations,
		);

		expect(violations.filter((item) => item.rule_id() === "unused-class")).toEqual([]);
	});

	test("does not report Python __slots__ as an unused public field", () => {
		const fixture = new TestFixture();
		const violations = fixture.with_lint_request(
			new LintRunConfiguration(new SourceText(), new NodeFileIO(process.cwd())),
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

		expect(violations.filter((violation) => violation.rule_id() === "unused-public-field")).toEqual([]);
	});

	test("checks Python slot names as fields instead of checking __slots__ metadata", () => {
		const fixture = new TestFixture();
		const violations = fixture.with_lint_request(
			new LintRunConfiguration(new SourceText(), new NodeFileIO(process.cwd())),
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
				.filter((violation) => ["python-explicit-field-type", "unused-public-field"].includes(violation.rule_id()))
				.map((violation) => `${violation.rule_id()}:${violation.file()}:${violation.line()}:${violation.message()}`)
				.sort(),
		).toEqual([
			'python-explicit-field-type:source.py:2:Python field "unused_value" is missing an explicit type',
			'unused-public-field:source.py:2:public field "unused_value" has no production usage',
		]);
	});

	test("resolves aliased slots and accepts annotated string slots", () => {
		const fixture = new TestFixture();
		const violations = fixture.with_lint_request(
			new LintRunConfiguration(new SourceText(), new NodeFileIO(process.cwd())),
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
				.filter((violation) => ["python-explicit-field-type", "unused-public-field"].includes(violation.rule_id()))
				.map((violation) => `${violation.rule_id()}:${violation.file()}:${violation.message()}`)
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
			new LintRunConfiguration(new SourceText(), new NodeFileIO(process.cwd())),
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
				.filter((violation) => violation.rule_id() === "unused-public-field")
				.map((violation) => `${violation.file()}:${violation.message()}`),
		).toEqual(['source.py:public field "unused_value" has no production usage']);
	});
});
