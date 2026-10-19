import { describe, expect, test } from "@jest/globals";
import { LintRunConfiguration } from "src/core/lint_run_configuration";
import { SourceText } from "src/source_text";
import { NodeFileIO } from "src/io/node_file_io";
import { TestFixture } from "tests/core/test-fixture";

describe("proxy lambda rules", () => {
	test("rejects proxy lambdas in both languages", () => {
		const fixture = new TestFixture();
		const execution = fixture.with_lint_request(
			new LintRunConfiguration(new SourceText(), new NodeFileIO()),
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

		expect(execution.report.violations.filter((item) => item.rule_id === "proxy-lambda")).toHaveLength(2);
	});

	test("rejects parenthesized proxy lambda calls", () => {
		const fixture = new TestFixture();
		const execution = fixture.with_lint_request(
			new LintRunConfiguration(new SourceText(), new NodeFileIO()),
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

		expect(execution.report.violations.filter((item) => item.rule_id === "proxy-lambda")).toHaveLength(1);
	});

	test("does not report event listener callbacks as proxy lambdas", () => {
		const fixture = new TestFixture();
		const execution = fixture.with_lint_request(
			new LintRunConfiguration(new SourceText(), new NodeFileIO()),
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

		expect(execution.report.violations.filter((item) => item.rule_id === "proxy-lambda")).toHaveLength(0);
	});

	test("allows direct delegation to a Node platform API in an adapter", () => {
		const fixture = new TestFixture();
		const execution = fixture.with_lint_request(
			new LintRunConfiguration(new SourceText(), new NodeFileIO()),
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

		expect(execution.report.violations.filter((item) => item.rule_id === "proxy-callable")).toHaveLength(0);
	});

	test("limits implemented interfaces and protocols per class", () => {
		const fixture = new TestFixture();
		const execution = fixture.with_lint_request(
			new LintRunConfiguration(new SourceText(), new NodeFileIO()),
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

		expect(execution.report.violations.filter((item) => item.rule_id === "class-interface-count")).toHaveLength(2);
	});
});
