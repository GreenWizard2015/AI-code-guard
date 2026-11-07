import "src/linting/composition/composition_model";
import { LintRunConfiguration } from "src/core/lint_run_configuration";
import { NodeFileIO } from "src/io/node_file_io";
import { SourceText } from "src/io/source_text";
import "src/callable_usage";
import { describe, expect, test } from "@jest/globals";
import { TYPESCRIPT_USAGE_FILES } from "tests/core/constants/callable_usage/constants";
import { TestFixture } from "tests/core/test-fixture";

describe("coding-lint callable usage rule", () => {
	const test_fixture = new TestFixture();

	test("reports TypeScript functions and methods with no external production callers", () => {
		const violations = test_fixture.with_lint_request(
			new LintRunConfiguration(new SourceText(), new NodeFileIO(process.cwd())),
			TYPESCRIPT_USAGE_FILES,
			(production_lint_configuration, options, mode) =>
				production_lint_configuration.lint_report(options, mode).report.violations,
		);
		const existing_rule_violations = violations.filter(
			(violation) => !violation.rule_id().startsWith("responsibilities"),
		);
		const messages = existing_rule_violations.map((violation) => violation.message());
		expect({
			once: messages.includes(
				'function "once" has insufficient production usage (found 1 other production file; candidate for removal/refactor)',
			),
			test_only: messages.includes('function "testOnly" is referenced only from tests'),
			service_once: messages.includes(
				'method "Service.once" has insufficient production usage (found 1 other production file; candidate for removal/refactor)',
			),
			private_function: messages.some((message) => message.includes('function "_privateFunction" is used')),
			private_method: messages.some((message) => message.includes('method "Service.privateOnce" is used')),
			twice: messages.some((message) => message.includes('function "twice" is used')),
			service_twice: messages.some((message) => message.includes('method "Service.twice" is used')),
			info_only: existing_rule_violations.some((violation) => {
				if (!violation.message().includes('function "once"')) {
					return false;
				}
				return violation.priority() !== 1;
			}),
		}).toEqual({
			once: false,
			test_only: true,
			service_once: false,
			private_function: false,
			private_method: false,
			twice: false,
			service_twice: false,
			info_only: false,
		});
	});
	test("reports TypeScript functions and methods referenced only from tests", () => {
		const violations = test_fixture.with_lint_request(
			new LintRunConfiguration(new SourceText(), new NodeFileIO(process.cwd())),
			{
				"source.ts":
					"export function read_value(): number { return 1; } export class Service { read() { return 1; } other() { return 2; } }",
				"tests/usage.test.ts":
					"import { read_value, Service } from '../source'; const service = new Service(); read_value(); service.read();",
			},
			(production_lint_configuration, options, mode) =>
				production_lint_configuration.lint_report(options, mode).report.violations,
		);
		expect({
			test_only_count: violations.filter((violation) => violation.rule_id() === "test-only-usage").length,
			unused_callable_messages: violations
				.filter((violation) => violation.rule_id() === "unused-callable")
				.map((violation) => violation.message()),
		}).toEqual({
			test_only_count: 2,
			unused_callable_messages: [
				'method "Service.other" has insufficient production usage (found 0 other production files; candidate for removal/refactor)',
			],
		});
	});
	test("counts an interface-dispatched production call to an implemented method", () => {
		const violations = test_fixture.with_lint_request(
			new LintRunConfiguration(new SourceText(), new NodeFileIO(process.cwd())),
			{
				"text_rules.ts": [
					"export interface TextRulesContract {",
					"  text_file_violations(file: string, text: string): string[];",
					"}",
					"export class NonEnglishSourceTextRules implements TextRulesContract {",
					"  public text_file_violations(file: string, text: string): string[] { return []; }",
					"}",
				].join("\n"),
				"text_project.ts": [
					"import type { TextRulesContract } from './text_rules';",
					"export class TextProject {",
					"  private readonly rules: TextRulesContract;",
					"  public constructor(rules: TextRulesContract) { this.rules = rules; }",
					"  public analyze(file: string, text: string): string[] { return this.rules.text_file_violations(file, text); }",
					"}",
				].join("\n"),
				"text_discovery.ts": [
					"import { NonEnglishSourceTextRules } from './text_rules';",
					"import { TextProject } from './text_project';",
					"export class TextDiscovery {",
					"  public project(): TextProject { return new TextProject(new NonEnglishSourceTextRules()); }",
					"}",
				].join("\n"),
			},
			(production_lint_configuration, options, mode) =>
				production_lint_configuration.lint_report(options, mode).report.violations,
		);
		expect(
			violations.filter(
				(violation) =>
					violation.rule_id() === "test-only-usage" &&
					violation.message().includes("NonEnglishSourceTextRules.text_file_violations"),
			),
		).toHaveLength(0);
	});
	test("counts constructor-wired contract calls as production usage", () => {
		const violations = test_fixture.with_lint_request(
			new LintRunConfiguration(new SourceText(), new NodeFileIO(process.cwd())),
			{
				"selector_contract.ts": ["export interface SelectorContract { select(): string; }"].join("\n"),
				"selector.ts": [
					"import type { SelectorContract } from './selector_contract';",
					"export class Selector implements SelectorContract {",
					"  public select(): string { return 'selected'; }",
					"}",
				].join("\n"),
				"consumer.ts": [
					"import type { SelectorContract } from './selector_contract';",
					"import { Selector } from './selector';",
					"export class Consumer {",
					"  private readonly selector: SelectorContract;",
					"  public constructor() { this.selector = new Selector(); }",
					"  public run(): string { return this.selector.select(); }",
					"}",
				].join("\n"),
				"tests/consumer.test.ts": [
					"import { Consumer } from '../consumer';",
					"test('runs the consumer', () => { new Consumer().run(); });",
				].join("\n"),
			},
			(production_lint_configuration, options, mode) =>
				production_lint_configuration.lint_report(options, mode).report.violations,
		);

		expect(
			violations.filter(
				(violation) =>
					["test-only-usage", "unused-callable"].includes(violation.rule_id()) &&
					violation.file() === "selector.ts" &&
					violation.message().includes("Selector.select"),
			),
		).toHaveLength(0);
	});
	test("counts methods called by a production document assembler", () => {
		const violations = test_fixture.with_lint_request(
			new LintRunConfiguration(new SourceText(), new NodeFileIO(process.cwd())),
			{
				"rule_section.ts": [
					"export class RuleSection {",
					"  public rule_id(): string { return 'rule'; }",
					"  public format(): string { return 'section'; }",
					"}",
				].join("\n"),
				"issue_document.ts": [
					"import { RuleSection } from './rule_section';",
					"export class IssueDocument {",
					"  public write(): string {",
					"    const sections: RuleSection[] = [new RuleSection()];",
					"    sections.sort((left, right) => left.rule_id().localeCompare(right.rule_id()));",
					"    const rendered: string[] = [];",
					"    for (const section of sections) { rendered.push(section.format()); }",
					"    return rendered.join('\\n');",
					"  }",
					"}",
				].join("\\n"),
			},
			(production_lint_configuration, options, mode) =>
				production_lint_configuration.lint_report(options, mode).report.violations,
		);

		expect(
			violations.filter(
				(violation) => violation.rule_id() === "unused-callable" && violation.file() === "rule_section.ts",
			),
		).toEqual([]);
	});
	test("keeps method-name ambiguity separate between TypeScript and Python", () => {
		const violations = test_fixture.with_lint_request(
			new LintRunConfiguration(new SourceText(), new NodeFileIO(process.cwd())),
			{
				"resource.ts": [
					"export type ResourceIdentity = { readonly path: string; };",
					"export interface ResourceOperationsContract { file_text(): string; }",
					"export type ResourceContract = ResourceIdentity & ResourceOperationsContract;",
					"export class Resource implements ResourceContract {",
					"  public readonly path = '';",
					"  public file_text(): string { return ''; }",
					"}",
					"export interface FileAccessContract { file(path: string): ResourceContract; }",
				].join("\n"),
				"first_reader.ts": [
					"import type { FileAccessContract } from './resource';",
					"export class FirstReader {",
					"  public constructor(private readonly io: FileAccessContract) {}",
					"  public read(path: string): string { return this.io.file(path).file_text(); }",
					"}",
				].join("\n"),
				"second_reader.ts": [
					"import type { FileAccessContract } from './resource';",
					"export class SecondReader {",
					"  public constructor(private readonly io: FileAccessContract) {}",
					"  public read(path: string): string { return this.io.file(path).file_text(); }",
					"}",
				].join("\n"),
				"same_method_name.py": "class Other:\n    def file_text(self) -> str:\n        return ''\n",
			},
			(production_lint_configuration, options, mode) =>
				production_lint_configuration.lint_report(options, mode).report.violations,
		);

		expect(
			violations.filter(
				(violation) =>
					violation.rule_id() === "unused-callable" &&
					violation.file() === "resource.ts" &&
					violation.message().includes('method "Resource.file_text"'),
			),
		).toHaveLength(0);
	});
	test("counts bound methods as production usage", () => {
		const violations = test_fixture.with_lint_request(
			new LintRunConfiguration(new SourceText(), new NodeFileIO(process.cwd())),
			{
				"source.ts": ["export class Service {", "  once() { return 1; }", "}"].join("\n"),
				"one.ts": [
					"import { Service } from './source';",
					"const service = new Service();",
					"const callback = service.once.bind(service);",
				].join("\n"),
				"two.ts": [
					"import { Service } from './source';",
					"const service = new Service();",
					"const callback = service.once.bind(service);",
				].join("\n"),
			},
			(production_lint_configuration, options, mode) =>
				production_lint_configuration.lint_report(options, mode).report.violations,
		);

		expect(violations.some((violation) => violation.message().includes('method "Service.once" is used'))).toBe(false);
	});
	test("counts statically indexed methods as production usage when bound", () => {
		const violations = test_fixture.with_lint_request(
			new LintRunConfiguration(new SourceText(), new NodeFileIO(process.cwd())),
			{
				"source.ts": ["export class Service {", "  once() { return 1; }", "}"].join("\n"),
				"one.ts": [
					"import { Service } from './source';",
					"const service = new Service();",
					"const callback = service['once'].bind(service);",
				].join("\n"),
				"two.ts": [
					"import { Service } from './source';",
					"const service = new Service();",
					"const callback = service['once'].bind(service);",
				].join("\n"),
			},
			(production_lint_configuration, options, mode) =>
				production_lint_configuration.lint_report(options, mode).report.violations,
		);

		expect(violations.some((violation) => violation.message().includes('method "Service.once" is used'))).toBe(false);
	});
	test("counts wrapped statically indexed methods as production usage when bound", () => {
		const violations = test_fixture.with_lint_request(
			new LintRunConfiguration(new SourceText(), new NodeFileIO(process.cwd())),
			{
				"source.ts": ["export class Service {", "  once() { return 1; }", "}"].join("\n"),
				"one.ts": [
					"import { Service } from './source';",
					"const service = new Service();",
					"const callback = service['once']!.bind(service);",
				].join("\n"),
				"two.ts": [
					"import { Service } from './source';",
					"const service = new Service();",
					"const callback = service['once']!.bind(service);",
				].join("\n"),
			},
			(production_lint_configuration, options, mode) =>
				production_lint_configuration.lint_report(options, mode).report.violations,
		);

		expect(violations.some((violation) => violation.message().includes('method "Service.once" is used'))).toBe(false);
	});
	test("does not treat a method call with a satisfies object as Function.bind", () => {
		const violations = test_fixture.with_lint_request(
			new LintRunConfiguration(new SourceText(), new NodeFileIO(process.cwd())),
			{
				"source.ts": [
					"export interface Actions { onMoreRequested: () => void; }",
					"export class Service {",
					"  bind(actions: Actions): void {}",
					"}",
				].join("\n"),
				"caller.ts": [
					"import { Actions, Service } from './source';",
					"function bind_actions(view: Service): void {",
					"  view.bind({ onMoreRequested: () => undefined } satisfies Actions);",
					"}",
				].join("\n"),
			},
			(production_lint_configuration, options, mode) =>
				production_lint_configuration.lint_report(options, mode).report.violations,
		);

		expect(violations.some((violation) => violation.message().includes('method "Service.bind" is used'))).toBe(false);
	});
	test("counts methods called through static element access", () => {
		const violations = test_fixture.with_lint_request(
			new LintRunConfiguration(new SourceText(), new NodeFileIO(process.cwd())),
			{
				"source.ts": ["export class Service {", "  run(): void {}", "}"].join("\n"),
				"consumer.ts": [
					"import { Service } from './source';",
					"declare const service: Service;",
					"service['run']();",
				].join("\n"),
			},
			(production_lint_configuration, options, mode) =>
				production_lint_configuration.lint_report(options, mode).report.violations,
		);

		expect(violations.some((violation) => violation.message().includes('method "Service.run"'))).toBe(false);
	});
	test("counts methods bound from object-literal instance containers", () => {
		const violations = test_fixture.with_lint_request(
			new LintRunConfiguration(new SourceText(), new NodeFileIO(process.cwd())),
			{
				"source.ts": ["export class Service {", "  once() { return 1; }", "}"].join("\n"),
				"one.ts": [
					"import { Service } from './source';",
					"const waiters = { current: new Service() };",
					"const callback = waiters.current.once.bind(waiters.current);",
				].join("\n"),
			},
			(production_lint_configuration, options, mode) =>
				production_lint_configuration.lint_report(options, mode).report.violations,
		);

		expect(violations.some((violation) => violation.message().includes('method "Service.once" is used'))).toBe(false);
	});
	test("resolves bound methods from object-literal identifier containers", () => {
		const violations = test_fixture.with_lint_request(
			new LintRunConfiguration(new SourceText(), new NodeFileIO(process.cwd())),
			{
				"source.ts": ["export class Service {", "  once() { return 1; }", "}"].join("\n"),
				"one.ts": [
					"import { Service } from './source';",
					"const service = new Service();",
					"const waiters = { current: service };",
					"const callback = waiters.current.once.bind(waiters.current);",
				].join("\n"),
			},
			(production_lint_configuration, options, mode) =>
				production_lint_configuration.lint_report(options, mode).report.violations,
		);

		expect(violations.some((violation) => violation.message().includes('method "Service.once" is used'))).toBe(false);
	});
	test("resolves methods through typed getters", () => {
		const violations = test_fixture.with_lint_request(
			new LintRunConfiguration(new SourceText(), new NodeFileIO(process.cwd())),
			{
				"source.ts": ["export class Service {", "  once() {}", "}"].join("\n"),
				"caller.ts": [
					"import { Service } from './source';",
					"class Container {",
					"  get service(): Service { return new Service(); }",
					"  run(): void { this.service.once(); }",
					"}",
					"new Container().run();",
				].join("\n"),
			},
			(production_lint_configuration, options, mode) =>
				production_lint_configuration.lint_report(options, mode).report.violations,
		);

		expect(violations.some((violation) => violation.message().includes('method "Service.once" is used'))).toBe(false);
	});
	test("resolves methods through typed object parameters", () => {
		const violations = test_fixture.with_lint_request(
			new LintRunConfiguration(new SourceText(), new NodeFileIO(process.cwd())),
			{
				"source.ts": ["export class Service {", "  once() { return 1; }", "}"].join("\n"),
				"caller.ts": [
					"import { Service } from './source';",
					"type Parts = { service: Service };",
					"function attach(parts: Parts): void {",
					"  parts.service.once();",
					"}",
				].join("\n"),
			},
			(production_lint_configuration, options, mode) =>
				production_lint_configuration.lint_report(options, mode).report.violations,
		);

		expect(violations.some((violation) => violation.message().includes('method "Service.once" is used'))).toBe(false);
	});
});
