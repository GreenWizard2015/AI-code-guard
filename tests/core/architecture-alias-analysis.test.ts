import { describe, expect, test } from "@jest/globals";
import { LintRunConfiguration } from "src/core/lint_run_configuration";
import { SourceText } from "src/source_text";
import { NodeFileIO } from "src/io/node_file_io";
import { ALIAS_RULE_FILES, ALIAS_TEST_FILES } from "tests/core/constants";
import { TestFixture } from "tests/core/test-fixture";

describe("architecture and alias analysis", () => {
	test("detects wrapped runtime keys and reports reference thresholds excluding test files", () => {
		const five_references = Object.fromEntries(
			Array.from({ length: 5 }, (_, index) => [
				`five-${index}.ts`,
				`class ConsumerFive${index} { constructor(dependency: BaseFive) {} }`,
			]),
		);
		const fifteen_references = Object.fromEntries(
			Array.from({ length: 15 }, (_, index) => [
				`fifteen-${index}.ts`,
				`class ConsumerFifteen${index} { constructor(dependency: BaseFifteen) {} }`,
			]),
		);
		const fixture = new TestFixture();
		const violations = fixture.with_lint_request(
			new LintRunConfiguration(new SourceText(), new NodeFileIO()),
			{
				"wrapped-dynamic-runtime.ts": [
					"declare const target: object;",
					"declare const thisArg: object;",
					"declare const args: unknown[];",
					'Reflect["apply"](target, thisArg, args);',
					'Reflect[("apply")](target, thisArg, args);',
					'Reflect["apply" as "apply"](target, thisArg, args);',
					'const method_name = "apply";',
					"Reflect[method_name](target, thisArg, args);",
				].join("\n"),
				"base-five.ts": "class BaseFive {}",
				"base-fifteen.ts": "class BaseFifteen {}",
				...five_references,
				...fifteen_references,
				"base-five.test.ts": "class TestConsumer { constructor(dependency: BaseFive) {} }",
			},
			(production_lint_configuration, options, mode) =>
				production_lint_configuration.lint_report(options, mode).report.violations,
		);
		expect({
			dynamic_runtime: violations.filter((item) => item.rule_id === "typescript-dynamic-runtime-usage").length,
			five_reference: violations.filter((item) => item.rule_id === "class-reference-info").map((item) => item.message),
			fifteen_reference: violations
				.filter((item) => item.rule_id === "class-reference-warning")
				.map((item) => [item.message, item.priority]),
		}).toEqual({
			dynamic_runtime: 4,
			five_reference: expect.arrayContaining([
				'class "BaseFive" is referenced from 5 files outside its definition file',
			]),
			fifteen_reference: expect.arrayContaining([
				['class "BaseFifteen" is referenced from 15 files outside its definition file', 3],
			]),
		});
	});

	test("detects invalid reexports, inline types, and aliases in both languages", () => {
		const fixture = new TestFixture();
		const violations = fixture.with_lint_request(
			new LintRunConfiguration(new SourceText(), new NodeFileIO()),
			{
				...ALIAS_RULE_FILES,
				...ALIAS_TEST_FILES,
				"inline-class.ts": [
					"const service = new (class Service { run(): void {} })();",
					'const annotated: { id: string } = { id: "candidate" };',
					"const asserted = value as { id: string };",
					"const satisfied = value satisfies { id: string };",
					"function reader(value: ({ id: string })): void { void value; }",
					'const named: NamedValue = { id: "control" };',
					"type NamedValue = { id: string };",
				].join("\n"),
				"callback-type.ts": [
					"class AliasCollector {",
					"  constructor(private readonly add_alias: (aliases: Map<string, Set<string>>, name: string, property: string) => boolean) {}",
					"}",
				].join("\n"),
				"reexport.py": ["from typing import (", "    Any as CandidateValue,", "    Optional,", ")"].join("\n"),
				"type-reexport.ts": "export type { FacebookDatabase } from './database';\n",
			},
			(production_lint_configuration, options, mode) =>
				production_lint_configuration.lint_report(options, mode).report.violations,
		);
		const messages = violations.map((item) => item.message);
		expect({
			temporary_assignments: messages.filter((message) => message === "avoid pointless temporary assignments").length,
			inline_object_types: messages.filter((message) => message === "avoid inline object types").length,
			inline_union: messages.includes("avoid inline literal union types"),
			reexport_message: messages.includes(
				"avoid re-exporting imported symbols: use the defining module directly instead of re-exporting it",
			),
			reexports: violations.filter((item) => item.rule_id === "reexports").length,
		}).toEqual({
			temporary_assignments: 9,
			inline_object_types: 8,
			inline_union: true,
			reexport_message: true,
			reexports: 3,
		});
	});
});
