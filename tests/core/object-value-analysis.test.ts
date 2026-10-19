import { describe, expect, test } from "@jest/globals";
import { LintRunConfiguration } from "src/core/lint_run_configuration";
import { SourceText } from "src/source_text";
import { NodeFileIO } from "src/io/node_file_io";
import { TestFixture } from "tests/core/test-fixture";

describe("object value analysis", () => {
	test("identifies callable object impostors and dynamic result shapes", () => {
		const fixture = new TestFixture();
		const violations = fixture.with_lint_request(
			new LintRunConfiguration(new SourceText(), new NodeFileIO()),
			{
				"fake-object.ts": [
					"export const CHAT_INPUT_TOOLS = {",
					"  getComposerInput: (input: HTMLElement) => input,",
					"  getComposerInputOrNull: (input: HTMLElement) => input,",
					"  isComposerEmpty: (input: HTMLElement) => !input.textContent,",
					"};",
					"const CONFIG = { timeoutMs: 1000, enabled: true };",
				].join("\n"),
				"parser.ts": [
					"const AGENT_PARSER = {",
					"  raise_task_error(payload: unknown): void { throw new Error(String(payload)); },",
					"};",
				].join("\n"),
				"callable-objects.ts": [
					"const run = () => {};",
					"const value = { run(input: string) { return input; } };",
					"const aliased = { run };",
					"const wrapped = { run: (function () {}) };",
				].join("\n"),
				"accessor.ts": ["const state = {", '  get name(): string { return "value"; },', "};"].join("\n"),
				"external-contract.ts": [
					'import type { TypeScriptConfigHostContract } from "external/types";',
					"const config_host: TypeScriptConfigHostContract = {",
					"  useCaseSensitiveFileNames: true,",
					"  readDirectory: () => [],",
					"  fileExists: () => true,",
					'  readFile: () => "source",',
					"};",
				].join("\n"),
				"internal-contract.ts": [
					'import type { Contract } from "src/contracts";',
					"const service: Contract = { run() {} };",
				].join("\n"),
				"tests/callable-object.test.ts": ["const value = {", "  run(input: string) { return input; },", "};"].join(
					"\n",
				),
				"callable-options.ts": ["configure({", "  onStart() {},", "});"].join("\n"),
				"result-shapes.ts": [
					"declare const result: Result;",
					"result['structuredContent'];",
					"result[`unwrap_tool_result`];",
					'result[("structuredContent")];',
					'const shape_key = "structuredContent";',
					"const response = {};",
					"response[shape_key];",
					'response["structured" + "Content"];',
				].join("\n"),
				"result-shapes.py": ['shape_key = "structuredContent"', "response = {}", "value = response[shape_key]"].join(
					"\n",
				),
			},
			(production_lint_configuration, options, mode) =>
				production_lint_configuration.lint_report(options, mode).report.violations,
		);
		expect(violations.filter((item) => item.rule_id === "typescript-fake-object")).toHaveLength(8);
		expect(
			violations.filter((item) => item.message === "avoid inferring tool results from multiple shapes"),
		).toHaveLength(5);
	});

	test("identifies callable object returns through aliases, spreads, and branches", () => {
		const fixture = new TestFixture();
		const violations = fixture.with_lint_request(
			new LintRunConfiguration(new SourceText(), new NodeFileIO()),
			{
				"contracts.ts": "export interface Contract { run(): void; }",
				"factory.ts": [
					"function create_tools() {",
					"  return {",
					"    async ask_thread(id: string, message: string) {",
					"      await submit_message(id, message);",
					"      return { id, submitted: true };",
					"    },",
					"  };",
					"}",
					"function create_alias(): Contract {",
					"  const value = { run() {} };",
					"  return value;",
					"}",
					"function create_spread(): Contract {",
					"  const service = { run() {} };",
					"  return { ...service };",
					"}",
					"function create_asserted_spread(): Contract {",
					"  const service = { run() {} };",
					"  return { ...(service as Contract) };",
					"}",
					"function create_inline_spread(): Contract { return { ...{ run() {} } }; }",
					"function create_conditional(use_first: boolean): Contract { return use_first ? { run() {} } : { run() {} }; }",
					"function create_logical(use_first: boolean): Contract { return (use_first && { run() {} }) || { run() {} }; }",
					"function create_nullish(existing: Contract | undefined): Contract { return existing ?? { run() {} }; }",
					"function create_comma(use_first: boolean): Contract { return (use_first, { run() {} }); }",
					"function create_object(): Contract { const { run } = { run() {} }; return { run }; }",
					"function create_array(): Contract { const [run] = [() => {}]; return { run }; }",
					"function create_nested(): Contract { const { service: { run } } = { service: { run() {} } }; return { run }; }",
					"function create_nested_spread(): Contract { const { service } = ({ service: { run() {} } }); return { ...service }; }",
					"function create_indexed(): Contract { return [{ run() {} }][0]; }",
				].join("\n"),
			},
			(production_lint_configuration, options, mode) =>
				production_lint_configuration.lint_report(options, mode).report.violations,
		);
		expect(violations.filter((item) => item.rule_id === "typescript-fake-object")).toHaveLength(16);
	});
});
