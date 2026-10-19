import "src/linting/orchestration/runtime/global-analysis/composition_model";
import { LintRunConfiguration } from "src/core/lint_run_configuration";
import { SourceText } from "src/source_text";
import { NodeFileIO } from "src/io/node_file_io";
import "src/linting/orchestration/runtime/global-analysis/callable-usage/callable_usage";
import { TestFixture } from "tests/core/test-fixture";
import { describe, expect, test } from "@jest/globals";
import { STRUCTURAL_ALIAS_FILES } from "tests/core/constants";
import { join } from "node:path";

describe("coding-lint callable usage rule", () => {
	test("does not report methods implementing an interface declared in another file", () => {
		const test_fixture = new TestFixture();

		const violations = test_fixture.with_lint_request(
			new LintRunConfiguration(new SourceText(), new NodeFileIO()),
			{
				"contract.ts": ["export interface ServicePort { run(): void; }"].join("\n"),
				"service.ts": [
					"import type { ServicePort } from './contract';",
					"export class Service implements ServicePort {",
					"  run() {}",
					"}",
				].join("\n"),
				"one.ts": ["import { Service } from './service';", "const service = new Service();", "service.run();"].join(
					"\n",
				),
			},
			(production_lint_configuration, options, mode) =>
				production_lint_configuration.lint_report(options, mode).report.violations,
		);

		expect(violations.some((violation) => violation.message.includes('method "Service.run"'))).toBe(false);
	});

	test("resolves structural methods through nested port types", () => {
		const test_fixture = new TestFixture();

		const violations = test_fixture.with_lint_request(
			new LintRunConfiguration(new SourceText(), new NodeFileIO()),
			{
				"source.ts": [
					"export interface AgentPort { load(): void; }",
					"export type Runtime = { agent: AgentPort };",
					"export class AgentService {",
					"  load() {}",
					"}",
				].join("\n"),
				"one.ts": [
					"import type { Runtime } from './source';",
					"declare const runtime: Runtime;",
					"runtime.agent.load();",
				].join("\n"),
			},
			(production_lint_configuration, options, mode) =>
				production_lint_configuration.lint_report(options, mode).report.violations,
		);

		expect(
			violations.some((violation) =>
				violation.message.includes('method "AgentService.load" has insufficient production usage (found 0'),
			),
		).toBe(false);
	});

	test("resolves methods through fields of imported classes", () => {
		const test_fixture = new TestFixture();

		const violations = test_fixture.with_lint_request(
			new LintRunConfiguration(new SourceText(), new NodeFileIO()),
			{
				"leaf.ts": ["export class Leaf {", "  run(): void {}", "}"].join("\n"),
				"holder.ts": [
					"import type { Leaf } from './leaf';",
					"export class Holder {",
					"  readonly leaf: Leaf;",
					"  constructor(leaf: Leaf) {",
					"    this.leaf = leaf;",
					"  }",
					"}",
				].join("\n"),
				"caller.ts": [
					"import { Holder } from './holder';",
					"import { Leaf } from './leaf';",
					"const holder = new Holder(new Leaf());",
					"holder.leaf.run();",
				].join("\n"),
			},
			(production_lint_configuration, options, mode) =>
				production_lint_configuration.lint_report(options, mode).report.violations,
		);

		expect(
			violations.some((violation) =>
				violation.message.includes(
					'method "Leaf.run" has insufficient production usage (found 0 other production files',
				),
			),
		).toBe(false);
	});

	test("keeps factory results bound to their exported class file", () => {
		const test_fixture = new TestFixture();
		const violations = test_fixture.with_lint_request(
			new LintRunConfiguration(new SourceText(), new NodeFileIO()),
			{
				"first.ts": [
					"export class Service { execute(): number { return 1; } }",
					"export function create(): Service { return new Service(); }",
				].join("\n"),
				"second.ts": "export class Service { execute(): number { return 2; } }",
				"consumer.ts": ["import { create } from './first';", "const client = create();", "client.execute();"].join(
					"\n",
				),
			},
			(production_lint_configuration, options, mode) =>
				production_lint_configuration.lint_report(options, mode).report.violations,
		);
		expect(
			violations
				.filter((violation) => violation.rule_id === "unused-callable")
				.map((violation) => violation.file)
				.filter((file) => file === "first.ts" || file === "second.ts"),
		).toEqual(["second.ts"]);
	});

	test("keeps generic factory results bound to the outer class", () => {
		const test_fixture = new TestFixture();
		const violations = test_fixture.with_lint_request(
			new LintRunConfiguration(new SourceText(), new NodeFileIO()),
			{
				"item.ts": "export class Item { execute(): number { return 1; } }",
				"box.ts": "export class Box<T> { execute(): number { return 2; } }",
				"factory.ts": [
					"import { Box } from './box';",
					"import { Item } from './item';",
					"export function create(): Box<Item> { return new Box<Item>(); }",
				].join("\n"),
				"consumer.ts": ["import { create } from './factory';", "const value = create();", "value.execute();"].join(
					"\n",
				),
			},
			(production_lint_configuration, options, mode) =>
				production_lint_configuration.lint_report(options, mode).report.violations,
		);

		expect(
			violations
				.filter((violation) => violation.rule_id === "unused-callable")
				.map((violation) => violation.file)
				.filter((file) => file === "box.ts" || file === "item.ts"),
		).toEqual(["item.ts"]);
	});

	test("does not use an outer factory when a callable parameter shadows it", () => {
		const test_fixture = new TestFixture();
		const violations = test_fixture.with_lint_request(
			new LintRunConfiguration(new SourceText(), new NodeFileIO()),
			{
				"first.ts": "export class First { execute(): number { return 1; } }",
				"second.ts": "export class Second { execute(): number { return 2; } }",
				"consumer.ts": [
					"import { First } from './first';",
					"import { Second } from './second';",
					"function create(): First { return new First(); }",
					"function run(create: () => Second): void {",
					"  const client = create();",
					"  client.execute();",
					"}",
					"run(() => new Second());",
				].join("\n"),
			},
			(production_lint_configuration, options, mode) =>
				production_lint_configuration.lint_report(options, mode).report.violations,
		);

		expect(
			violations
				.filter((violation) => violation.rule_id === "unused-callable")
				.map((violation) => violation.file)
				.filter((file) => file === "first.ts" || file === "second.ts"),
		).toEqual(["first.ts", "second.ts"]);
	});

	test("keeps static and instance factory methods separate", () => {
		const test_fixture = new TestFixture();
		const violations = test_fixture.with_lint_request(
			new LintRunConfiguration(new SourceText(), new NodeFileIO()),
			{
				"first.ts": "export class First { execute(): number { return 1; } }",
				"second.ts": "export class Second { execute(): number { return 2; } }",
				"consumer.ts": [
					"import { First } from './first';",
					"import { Second } from './second';",
					"class Holder {",
					"  static create(): First { return new First(); }",
					"  create(): Second { return new Second(); }",
					"}",
					"const first = Holder.create();",
					"const second = new Holder().create();",
					"first.execute();",
					"second.execute();",
				].join("\n"),
			},
			(production_lint_configuration, options, mode) =>
				production_lint_configuration.lint_report(options, mode).report.violations,
		);

		expect(
			violations
				.filter((violation) => violation.rule_id === "unused-callable")
				.map((violation) => violation.file)
				.filter((file) => file === "first.ts" || file === "second.ts"),
		).toEqual([]);
	});

	test("resolves all references through one nested ownership graph", () => {
		const test_fixture = new TestFixture();

		const violations = test_fixture.with_lint_request(
			new LintRunConfiguration(new SourceText(), new NodeFileIO()),
			{
				"source.ts": [
					"export interface ReaderPort { read(): void; }",
					"export type ReaderState = { reader: ReaderPort };",
					"export class Reader {",
					"  read() {}",
					"}",
				].join("\n"),
				"one.ts": [
					"import type { ReaderState } from './source';",
					"declare const state: ReaderState;",
					"state.reader.read();",
					"state.reader.read();",
				].join("\n"),
				"two.ts": [
					"import type { ReaderState } from './source';",
					"declare const state: ReaderState;",
					"state.reader.read();",
				].join("\n"),
			},
			(production_lint_configuration, options, mode) =>
				production_lint_configuration.lint_report(options, mode).report.violations,
		);

		expect(violations.some((violation) => violation.message.includes('method "Reader.read"'))).toBe(false);
	});

	test("resolves methods called through imported singleton instances", () => {
		const test_fixture = new TestFixture();

		const violations = test_fixture.with_lint_request(
			new LintRunConfiguration(new SourceText(), new NodeFileIO()),
			{
				"tools.ts": [
					"export class Tools {",
					"  normalize() { return 1; }",
					"}",
					"export const TOOLS = new Tools();",
				].join("\n"),
				"one.ts": ["import { TOOLS } from './tools';", "TOOLS.normalize();"].join("\n"),
				"two.ts": ["import { TOOLS } from './tools';", "TOOLS.normalize();"].join("\n"),
			},
			(production_lint_configuration, options, mode) =>
				production_lint_configuration.lint_report(options, mode).report.violations,
		);

		expect(violations.some((violation) => violation.message.includes('method "Tools.normalize" is used'))).toBe(false);
	});

	test("resolves constructor properties and structural type aliases", () => {
		const test_fixture = new TestFixture();

		const violations = test_fixture.with_lint_request(
			new LintRunConfiguration(new SourceText(), new NodeFileIO()),
			STRUCTURAL_ALIAS_FILES,
			(production_lint_configuration, options, mode) =>
				production_lint_configuration.lint_report(options, mode).report.violations,
		);

		expect(
			violations.some((violation) =>
				/method "(Dependency\.run|Consumer\.execute|Panel\.execute)" is used/.test(violation.message),
			),
		).toBe(false);
	});

	test("counts calls through a typed matcher field as production usage", () => {
		const test_fixture = new TestFixture();
		const files = {
			"matcher.ts": [
				"export interface MatcherContract { match_candidate(value: string): boolean; }",
				"export class Matcher implements MatcherContract {",
				"  match_candidate(value: string): boolean { return value.length > 0; }",
				"}",
			].join("\n"),
			"pattern.ts": [
				"import { Matcher } from './matcher';",
				"import type { MatcherContract } from './matcher';",
				"export type Pattern = { matcher: MatcherContract };",
				"export const pattern: Pattern = { matcher: new Matcher() };",
			].join("\n"),
			"consumer.ts": [
				"import { pattern } from './pattern';",
				"export function ignored(value: string): boolean {",
				"  return pattern.matcher.match_candidate(value);",
				"}",
			].join("\n"),
		};
		const references = test_fixture.with_in_memory_project(
			files,
			(root, context) =>
				context
					.source_record(join(root, "consumer.ts"))
					.normalized_ast.call_references.filter((reference) => reference.name === "match_candidate"),
			new Map(),
		);
		const violations = test_fixture.with_lint_request(
			new LintRunConfiguration(new SourceText(), new NodeFileIO()),
			files,
			(production_lint_configuration, options, mode) =>
				production_lint_configuration.lint_report(options, mode).report.violations,
		);

		expect({
			references: references.map((reference) => reference.name),
			method_violations: violations.filter(
				(violation) =>
					(violation.rule_id === "test-only-usage" || violation.rule_id === "unused-callable") &&
					violation.message.includes("Matcher.match_candidate"),
			),
		}).toEqual({ references: ["match_candidate"], method_violations: [] });
	});
});
