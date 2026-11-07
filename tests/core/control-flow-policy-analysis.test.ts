import { describe, expect, test } from "@jest/globals";
import { LintRunConfiguration } from "src/core/lint_run_configuration";
import { NodeFileIO } from "src/io/node_file_io";
import { SourceText } from "src/io/source_text";
import { CONDITIONAL_BLOCK_FILES, FORWARDING_FILES } from "tests/core/constants/ast_analysis/constants";
import { TestFixture } from "tests/core/test-fixture";

describe("conditional execution and forwarding analysis", () => {
	test("distinguishes primitive operators and enforces explicit conditional blocks", () => {
		const fixture = new TestFixture();
		const violations = fixture.with_lint_request(
			new LintRunConfiguration(new SourceText(), new NodeFileIO(process.cwd())),
			{
				"primitive-conditions.ts": [
					'const text = "a" || "b";',
					"const number = 1 && 2;",
					"const object = left && right;",
				].join("\n"),
				"typed-conditions.ts": [
					"interface Metadata { externalId?: string; }",
					"declare const metadata: Metadata;",
					'const first = metadata.externalId ?? "fallback";',
					'const left: string | undefined = "left";',
					'const right: string | undefined = "right";',
					"const second = left ?? right;",
					"declare const object: Record<string, string>;",
					"const invalid = object ?? metadata;",
				].join("\n"),
				...CONDITIONAL_BLOCK_FILES,
				"else-without-braces.ts": "if (ready) { submit(); } else recover();",
			},
			(production_lint_configuration, options, mode) =>
				production_lint_configuration.lint_report(options, mode).report.violations,
		);
		const messages = violations.map((item) => item.message());
		expect({
			conditional_execution: violations.filter((item) => item.rule_id() === "conditional-execution").length,
			typescript_braces: messages.filter((message) => message === "TypeScript if and else branches must use braces")
				.length,
			python_elif: messages.filter((message) => message === "avoid Python elif branches").length,
		}).toEqual({ conditional_execution: 0, typescript_braces: 3, python_elif: 1 });
	});

	test("accepts explicit if branches without conditional expression diagnostics", () => {
		const fixture = new TestFixture();
		const violations = fixture.with_lint_request(
			new LintRunConfiguration(new SourceText(), new NodeFileIO(process.cwd())),
			{
				...CONDITIONAL_BLOCK_FILES,
				"else-without-braces.ts": "if (ready) { submit(); } else recover();",
			},
			(production_lint_configuration, options, mode) =>
				production_lint_configuration.lint_report(options, mode).report.violations,
		);

		expect(violations.filter((item) => item.rule_id() === "conditional-execution")).toEqual([]);
	});

	test("detects forwarding callables through direct, wrapped, awaited, and spread calls", () => {
		const fixture = new TestFixture();
		const violations = fixture.with_lint_request(
			new LintRunConfiguration(new SourceText(), new NodeFileIO(process.cwd())),
			{
				...FORWARDING_FILES,
				"parenthesized-proxy.ts": [
					"declare const service: { run(value: string): string };",
					"function forward(value: string): string {",
					"  return (service.run)(value);",
					"}",
					"function forward_call(value: string): string {",
					"  return (service.run(value));",
					"}",
				].join("\n"),
				"awaited-proxy.ts": [
					"async function forward(value: string): Promise<string> {",
					"  return await handle(value);",
					"}",
				].join("\n"),
				"spread-proxy.ts": [
					"declare const service: { run(value: string): string };",
					"function forward(value: string): string {",
					"  return service.run(...[value]);",
					"}",
				].join("\n"),
				"polling-state.ts": [
					"class PollingState {",
					"\tprivate readonly available: boolean;",
					"\tpublic present(): boolean { return this.available; }",
					"}",
				].join("\n"),
			},
			(production_lint_configuration, options, mode) =>
				production_lint_configuration.lint_report(options, mode).report.violations,
		);
		const proxy_violations = violations.filter((item) => item.rule_id() === "proxy-callable");
		expect({
			count: proxy_violations.length,
			property_accessors: proxy_violations.some((item) => item.file() === "polling-state.ts"),
		}).toEqual({ count: 15, property_accessors: false });
	});
});
