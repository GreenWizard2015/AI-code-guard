import { describe, expect, test } from "@jest/globals";
import { LintRunConfiguration } from "src/core/lint_run_configuration";
import { NodeFileIO } from "src/io/node_file_io";
import { SourceText } from "src/io/source_text";
import { TestFixture } from "tests/core/test-fixture";

describe("proxy lambda rules", () => {
	test("reports a short contract implementation that only forwards its call", () => {
		const fixture = new TestFixture();
		const execution = fixture.with_lint_request(
			new LintRunConfiguration(new SourceText(), new NodeFileIO(process.cwd())),
			{
				"contract-proxy.ts": [
					"interface ValueReaderContract { read(value: string): string; }",
					"class ValueReader { public read(value: string): string { return value; } }",
					"class ValueReaderAdapter implements ValueReaderContract {",
					"  public constructor(private readonly reader: ValueReader) {}",
					"  public read(value: string): string { return this.reader.read(value); }",
					"}",
				].join("\n"),
			},
			(production_lint_configuration, options, mode) => production_lint_configuration.lint_report(options, mode),
		);

		expect(execution.report.violations.some((item) => item.rule_id() === "proxy-callable")).toBe(true);
	});

	test("reports short contract methods that only expose an instance field", () => {
		const fixture = new TestFixture();
		const execution = fixture.with_lint_request(
			new LintRunConfiguration(new SourceText(), new NodeFileIO(process.cwd())),
			{
				"contract-field-accessor.ts": [
					"interface SourceRecordContract { absolute_path(): string; }",
					"class SourceRecord implements SourceRecordContract {",
					"  private readonly _absolute_path: string = '/source.ts';",
					"  public absolute_path(): string { return this._absolute_path; }",
					"}",
				].join("\n"),
				"local-field-accessor.ts": [
					"class LocalRecord {",
					"  private readonly _local_path: string = '/local.ts';",
					"  public local_path(): string { return this._local_path; }",
					"}",
				].join("\n"),
			},
			(production_lint_configuration, options, mode) => production_lint_configuration.lint_report(options, mode),
		);

		const proxy_files = execution.report.violations
			.filter((item) => item.rule_id() === "proxy-callable")
			.map((item) => item.file());
		expect(proxy_files).toEqual(["contract-field-accessor.ts"]);
	});

	test("reports short contract methods forwarding to differently named accessors", () => {
		const fixture = new TestFixture();
		const execution = fixture.with_lint_request(
			new LintRunConfiguration(new SourceText(), new NodeFileIO(process.cwd())),
			{
				"contract-property-forwarding.ts": [
					"interface ProjectPathRelationContract { path(): string; inside_root(): boolean; }",
					"class ProjectPathRelation implements ProjectPathRelationContract {",
					"  private readonly _relative_path = 'src/file.ts';",
					"  private readonly _inside = true;",
					"  public path(): string { return this.relative_path; }",
					"  public inside_root(): boolean { return this.inside; }",
					"  public get relative_path(): string { return this._relative_path; }",
					"  public get inside(): boolean { return this._inside; }",
					"}",
				].join("\n"),
			},
			(production_lint_configuration, options, mode) => production_lint_configuration.lint_report(options, mode),
		);

		const proxy_lines = execution.report.violations
			.filter((item) => item.rule_id() === "proxy-callable")
			.map((item) => item.line())
			.sort((left, right) => left - right);
		expect(proxy_lines).toEqual([5, 6]);
	});

	test("rejects proxy lambdas in both languages", () => {
		const fixture = new TestFixture();
		const execution = fixture.with_lint_request(
			new LintRunConfiguration(new SourceText(), new NodeFileIO(process.cwd())),
			{
				"proxy-lambda.ts": [
					"type Expression = string;",
					"interface OwnerResolver { dispatch(expression: Expression, owner: string): string; }",
					"class Context implements OwnerResolver {",
					"\tpublic dispatch(expression: Expression, owner: string): string { return owner + expression; }",
					"\tpublic bad(): OwnerResolver {",
					"\t\tconst dispatch = this.dispatch;",
					"\t\treturn { dispatch: (expression, owner) => dispatch(owner, expression) };",
					"\t}",
					"\tpublic good(): OwnerResolver { return this; }",
					"}",
					"declare const external: OwnerResolver;",
					"const external_proxy = (expression: Expression, owner: string): string => external.dispatch(expression, owner);",
				].join("\n"),
				"proxy-lambda.py": [
					"class Context:",
					"    def dispatch(self, expression: str, owner: str) -> str:",
					"        return owner + expression",
					"    def bad(self):",
					"        return lambda expression, owner: self.dispatch(owner, expression)",
				].join("\n"),
			},
			(production_lint_configuration, options, mode) => production_lint_configuration.lint_report(options, mode),
		);

		expect(execution.report.violations.filter((item) => item.rule_id() === "proxy-lambda")).toHaveLength(2);
	});

	test("rejects parenthesized proxy lambda calls", () => {
		const fixture = new TestFixture();
		const execution = fixture.with_lint_request(
			new LintRunConfiguration(new SourceText(), new NodeFileIO(process.cwd())),
			{
				"proxy-lambda.ts": [
					"type Expression = string;",
					"interface OwnerResolver { dispatch(expression: Expression, owner: string): string; }",
					"class Context implements OwnerResolver {",
					"\tpublic dispatch(expression: Expression, owner: string): string { return owner + expression; }",
					"\tpublic wrapped(): OwnerResolver {",
					"\t\treturn { dispatch: (expression, owner) => (this.dispatch(owner, expression)) };",
					"\t}",
					"}",
				].join("\n"),
			},
			(production_lint_configuration, options, mode) => production_lint_configuration.lint_report(options, mode),
		);

		expect(execution.report.violations.filter((item) => item.rule_id() === "proxy-lambda")).toHaveLength(1);
	});

	test("does not report event listener callbacks as proxy lambdas", () => {
		const fixture = new TestFixture();
		const execution = fixture.with_lint_request(
			new LintRunConfiguration(new SourceText(), new NodeFileIO(process.cwd())),
			{
				"event-listener.ts": [
					"class Context {",
					"\tpublic call_owner(expression: string, owner: string): string { return owner + expression; }",
					"\tpublic attach(element: HTMLElement): void {",
					"\t\telement.addEventListener('event', (expression, owner) => this.call_owner(expression, owner));",
					"\t}",
					"}",
				].join("\n"),
			},
			(production_lint_configuration, options, mode) => production_lint_configuration.lint_report(options, mode),
		);

		expect(execution.report.violations.filter((item) => item.rule_id() === "proxy-lambda")).toHaveLength(0);
	});

	test("allows direct delegation to a Node platform API in an adapter", () => {
		const fixture = new TestFixture();
		const execution = fixture.with_lint_request(
			new LintRunConfiguration(new SourceText(), new NodeFileIO(process.cwd())),
			{
				"node-file-adapter.ts": [
					'import { existsSync } from "node:fs";',
					"class FileAdapter {",
					"\tpublic path_exists(path: string): boolean { return existsSync(path); }",
					"}",
				].join("\n"),
			},
			(production_lint_configuration, options, mode) => production_lint_configuration.lint_report(options, mode),
		);

		expect(execution.report.violations.filter((item) => item.rule_id() === "proxy-callable")).toHaveLength(0);
	});

	test("allows delegation through an adapter of an imported Node API type", () => {
		const fixture = new TestFixture();
		const execution = fixture.with_lint_request(
			new LintRunConfiguration(new SourceText(), new NodeFileIO(process.cwd())),
			{
				"node-process-adapter.ts": [
					'import type { ChildProcess } from "node:child_process";',
					"class ProcessAdapter {",
					"  private readonly child: ChildProcess;",
					"  public kill(signal: NodeJS.Signals): boolean { return this.child.kill(signal); }",
					"}",
				].join("\n"),
			},
			(production_lint_configuration, options, mode) => production_lint_configuration.lint_report(options, mode),
		);

		expect(execution.report.violations.filter((item) => item.rule_id() === "proxy-callable")).toHaveLength(0);
	});

	test("allows methods that mutate their own collection state", () => {
		const fixture = new TestFixture();
		const execution = fixture.with_lint_request(
			new LintRunConfiguration(new SourceText(), new NodeFileIO(process.cwd())),
			{
				"collection-state.ts": [
					"class CollectionState {",
					"  private readonly values: string[] = [];",
					"  public add(value: string): void { this.values.push(value); }",
					"}",
				].join("\n"),
				"collection_state.py": [
					"class CollectionState:",
					"    def __init__(self) -> None:",
					"        self.values: list[str] = []",
					"    def add(self, value: str) -> None:",
					"        self.values.append(value)",
				].join("\n"),
			},
			(production_lint_configuration, options, mode) => production_lint_configuration.lint_report(options, mode),
		);

		expect(execution.report.violations.filter((item) => item.rule_id() === "proxy-callable")).toHaveLength(0);
	});

	test("limits implemented interfaces and protocols per class", () => {
		const fixture = new TestFixture();
		const execution = fixture.with_lint_request(
			new LintRunConfiguration(new SourceText(), new NodeFileIO(process.cwd())),
			{
				"interfaces.ts": [
					"interface FirstPort {}",
					"interface SecondPort {}",
					"interface ThirdPort {}",
					"interface FourthPort {}",
					"class Adapter implements FirstPort, SecondPort, ThirdPort, FourthPort {}",
				].join("\n"),
				"protocols.py": [
					"from typing import Protocol",
					"class FirstPort(Protocol): ...",
					"class SecondPort(Protocol): ...",
					"class ThirdPort(Protocol): ...",
					"class FourthPort(Protocol): ...",
					"class Adapter(FirstPort, SecondPort, ThirdPort, FourthPort):",
					"    pass",
				].join("\n"),
			},
			(production_lint_configuration, options, mode) => production_lint_configuration.lint_report(options, mode),
		);

		expect(execution.report.violations.filter((item) => item.rule_id() === "class-interface-count")).toHaveLength(2);
	});
});
