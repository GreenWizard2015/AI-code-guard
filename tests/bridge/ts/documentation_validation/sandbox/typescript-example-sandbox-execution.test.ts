import { spawnSync } from "node:child_process";
import { describe, expect, test } from "@jest/globals";
import { CliDocumentationValidation } from "documentation_validation/cli_documentation_validation";
import { DocumentationExampleSandbox } from "documentation_validation/sandbox/documentation_example_sandbox";
import type { DocumentationExampleLintContract } from "documentation_validation/types";
import { TYPESCRIPT_SANDBOX_EXAMPLE } from "tests/documentation_validation/constants";
import { DocumentationProjectFixture } from "tests/documentation_validation/documentation_project_fixture";

describe("TypeScript example sandbox execution", () => {
	test("expands Markdown templates before sandbox execution and linting", () => {
		const sandbox = new DocumentationExampleSandbox(spawnSync);
		const markdown = [
			"# template-run",
			"## Good",
			"```ts",
			"// File: domain/output.ts",
			"export class Output {",
			"  public report(): void {",
			'{% const names = ["first", "second"] %}',
			"{% for name in names %}",
			'    console.log("{{name}}");',
			"{% endfor %}",
			"  }",
			"}",
			"// File: cli.ts",
			'import { Output } from "./domain/output";',
			"(function () { new Output().report(); })();",
			"```",
		].join("\n");
		const fixture = new DocumentationProjectFixture("/virtual/template-run", {
			"docs/rules/typescript/empty-error-handler.md": markdown,
		});
		const linted_source_texts: string[] = [];
		const lint_runner: DocumentationExampleLintContract = {
			lint: (_root, _source, _rule, source_files) => {
				linted_source_texts.push(...source_files.map((source_file) => source_file.text));
				return [];
			},
			with_worker: async (operation) => await operation(),
		};
		const validation_session = new CliDocumentationValidation(
			fixture._root,
			["empty-error-handler"],
			lint_runner,
			sandbox,
			fixture._source_io,
		);
		const validation = validation_session.validate([]);
		const good_result = validation.results.find(({ example }) => example.kind === "Good");

		expect({
			passed: good_result?.passed,
			structural_errors: good_result?.structural_errors,
			linted_first: linted_source_texts.some((text) => text.includes('console.log("first");')),
			linted_second: linted_source_texts.some((text) => text.includes('console.log("second");')),
			linted_template: linted_source_texts.some((text) => text.includes("{{name}}")),
		}).toEqual({
			passed: true,
			structural_errors: [],
			linted_first: true,
			linted_second: true,
			linted_template: false,
		});
	});

	test("executes in-memory TypeScript modules and captures their output", () => {
		const sandbox = new DocumentationExampleSandbox(spawnSync);
		const result = sandbox.capture_output(TYPESCRIPT_SANDBOX_EXAMPLE);

		expect(result).toEqual({ stdout: "ready\n", exit_code: 0 });
	});

	test("executes a static prototype assignment on a locally declared class", () => {
		const sandbox = new DocumentationExampleSandbox(spawnSync);
		const result = sandbox.capture_output({
			...TYPESCRIPT_SANDBOX_EXAMPLE,
			source_files: [
				{
					path: "src/user.ts",
					text: 'export class User {} User.prototype.status = function (): string { return "ready"; }; User.prototype.report = function (): void { console.log(this.status()); };',
				},
				{
					path: "cli.ts",
					text: 'import { User } from "src/user"; (function () { new User().report(); })();',
				},
			],
		});

		expect(result).toEqual({ stdout: "ready\n", exit_code: 0 });
	});

	test("executes safe Object.prototype methods and bound callbacks", () => {
		const sandbox = new DocumentationExampleSandbox(spawnSync);
		const result = sandbox.capture_output({
			...TYPESCRIPT_SANDBOX_EXAMPLE,
			source_files: [
				{
					path: "src/value_label.ts",
					text: [
						"export class ValueLabel { public label(value: string): string { return Object.prototype.toString.call(value); }",
						'public owns_value(value: object): boolean { return Object.prototype.hasOwnProperty.call(value, "ready"); }',
						'public report(): void { const callback = this.label.bind(this); console.log(`${callback("ready")} ${this.owns_value({ ready: true })}`); } }',
					].join(" "),
				},
				{
					path: "cli.ts",
					text: 'import { ValueLabel } from "src/value_label"; (function () { new ValueLabel().report(); })();',
				},
			],
		});

		expect(result).toEqual({ stdout: "[object String] true\n", exit_code: 0 });
	});

	test("runs test files from an example before validating its CLI output", () => {
		const sandbox = new DocumentationExampleSandbox(spawnSync);
		const result = sandbox.capture_output({
			...TYPESCRIPT_SANDBOX_EXAMPLE,
			source_files: [
				{
					path: "domain/status.ts",
					text: 'export class Status { public label(): string { return "ready"; } public report(): void { console.log(this.label()); } }',
				},
				{
					path: "tests/domain/status.test.ts",
					text: 'import { Status } from "../../domain/status"; describe("Status", () => { test("returns its label", async () => { const label = await Promise.resolve(new Status().label()); expect(label).toBe("ready"); }); });',
				},
				{
					path: "cli.ts",
					text: 'import { Status } from "./domain/status"; (function () { new Status().report(); })();',
				},
			],
		});

		expect(result).toEqual({ stdout: "ready\n", exit_code: 0 });
	});

	test("executes Jest assertions on an instance method in example tests", () => {
		const sandbox = new DocumentationExampleSandbox(spawnSync);
		const result = sandbox.capture_output({
			...TYPESCRIPT_SANDBOX_EXAMPLE,
			source_files: [
				{
					path: "src/status.ts",
					text: 'export class Status { public normalized(): string { return "ready"; } public report(): void { console.log(this.normalized()); } }',
				},
				{
					path: "tests/status.test.ts",
					text: 'import { Status } from "../../src/status"; test("exposes its normalized method", () => { const status = new Status(); expect(status.normalized).toBeDefined(); });',
				},
				{
					path: "cli.ts",
					text: 'import { Status } from "src/status"; (function () { new Status().report(); })();',
				},
			],
		});

		expect(result).toEqual({ stdout: "ready\n", exit_code: 0 });
	});

	test("resolves virtual test modules imported by production examples", () => {
		const sandbox = new DocumentationExampleSandbox(spawnSync);
		const result = sandbox.capture_output({
			...TYPESCRIPT_SANDBOX_EXAMPLE,
			source_files: [
				{
					path: "tests/support.ts",
					text: 'export class TestSupport { public message(): string { return "ready"; } }',
				},
				{
					path: "src/application.ts",
					text: 'import { TestSupport } from "tests/support"; export class Application { private readonly support: TestSupport; public constructor() { this.support = new TestSupport(); } public report(): void { console.log(this.support.message()); } }',
				},
				{
					path: "cli.ts",
					text: 'import { Application } from "src/application"; (function () { new Application().report(); })();',
				},
			],
		});

		expect(result).toEqual({ stdout: "ready\n", exit_code: 0 });
	});

	test("runs beforeEach hooks for every registered example test", () => {
		const sandbox = new DocumentationExampleSandbox(spawnSync);
		const result = sandbox.capture_output({
			...TYPESCRIPT_SANDBOX_EXAMPLE,
			source_files: [
				{
					path: "src/status.ts",
					text: 'export class Status { private value: string; public constructor(value: string) { this.value = value; } public reset(): void { this.value = "ready"; } public consume(): void { this.value = "pending"; } public current(): string { return this.value; } public report(): void { console.log(this.current()); } }',
				},
				{
					path: "tests/status.test.ts",
					text: 'import { Status } from "../../src/status"; describe("Status", () => { const status = new Status("pending"); beforeEach(() => { status.reset(); }); test("consumes ready status", () => { expect(status.current()).toBe("ready"); status.consume(); }); test("runs hook again", () => { expect(status.current()).toBe("ready"); }); });',
				},
				{
					path: "cli.ts",
					text: 'import { Status } from "src/status"; (function () { new Status("pending").report(); })();',
				},
			],
		});

		expect(result).toEqual({ stdout: "pending\n", exit_code: 0 });
	});

	test("scopes beforeEach hooks to their suite and inherits parent hooks", () => {
		const sandbox = new DocumentationExampleSandbox(spawnSync);
		const result = sandbox.capture_output({
			...TYPESCRIPT_SANDBOX_EXAMPLE,
			source_files: [
				{
					path: "src/status.ts",
					text: 'export class Status { private value = "pending"; public reset(value: string): void { this.value = value; } public current(): string { return this.value; } public report(): void { console.log(this.current()); } }',
				},
				{
					path: "tests/status.test.ts",
					text: 'import { Status } from "../../src/status"; const status = new Status(); describe("first", () => { beforeEach(() => status.reset("first")); test("uses first setup", () => { expect(status.current()).toBe("first"); status.reset("changed"); }); }); describe("second", () => { test("does not inherit sibling setup", () => { expect(status.current()).toBe("changed"); }); describe("nested", () => { beforeEach(() => status.reset("nested")); test("inherits its parent context", () => { expect(status.current()).toBe("nested"); }); }); });',
				},
				{ path: "cli.ts", text: 'import { Status } from "src/status"; (function () { new Status().report(); })();' },
			],
		});

		expect(result).toEqual({ stdout: "pending\n", exit_code: 0 });
	});

	test("reports failed assertions from example test files", () => {
		const sandbox = new DocumentationExampleSandbox(spawnSync);
		const result = sandbox.capture_output({
			...TYPESCRIPT_SANDBOX_EXAMPLE,
			source_files: [
				{
					path: "tests/domain/status.test.ts",
					text: 'test("fails on the wrong result", () => { expect("wrong").toBe("ready"); });',
				},
				{ path: "src/reporter.ts", text: 'export class Reporter { public report(): void { console.log("ready"); } }' },
				{
					path: "cli.ts",
					text: 'import { Reporter } from "./src/reporter"; (function () { new Reporter().report(); })();',
				},
			],
		});

		expect(result.exit_code).toBe(1);
		expect(result.stdout).toContain("Documentation test failed: toBe");
	});

	test("isolates sources and registered tests across sequential examples", () => {
		const sandbox = new DocumentationExampleSandbox(spawnSync);
		const first = {
			...TYPESCRIPT_SANDBOX_EXAMPLE,
			source_files: [
				{ path: "src/first.ts", text: 'export const value = "first";' },
				{
					path: "tests/first.test.ts",
					text: 'let calls = 0; test("first callback", () => { calls += 1; if (calls > 1) { throw new Error("stale callback ran"); } expect(calls).toBe(1); });',
				},
				{
					path: "cli.ts",
					text: 'import { value } from "src/first"; if (value.length === 0) { throw new Error("missing first source"); }',
				},
			],
		};
		const second = {
			...TYPESCRIPT_SANDBOX_EXAMPLE,
			source_files: [
				{ path: "tests/second.test.ts", text: 'test("second callback", () => { expect("second").toBe("second"); });' },
				{
					path: "cli.ts",
					text: 'import { value } from "src/first"; if (value.length === 0) { throw new Error("missing first source"); }',
				},
			],
		};
		const first_result = sandbox.capture_output(first);
		const second_result = sandbox.capture_output(second);

		expect({ first: first_result, second: second_result }).toEqual({
			first: { stdout: "", exit_code: 0 },
			second: { stdout: expect.stringContaining("outside the example sources"), exit_code: 1 },
		});
	});

	test("rejects asynchronous assertion failures before CLI execution", () => {
		const sandbox = new DocumentationExampleSandbox(spawnSync);
		const result = sandbox.capture_output({
			...TYPESCRIPT_SANDBOX_EXAMPLE,
			source_files: [
				{
					path: "tests/async.test.ts",
					text: 'test("fails after await", async () => { await Promise.resolve(); expect("async sentinel").toBe("ready"); });',
				},
				{
					path: "src/reporter.ts",
					text: 'export class Reporter { public report(): void { console.log("cli sentinel"); } }',
				},
				{
					path: "cli.ts",
					text: 'import { Reporter } from "./src/reporter"; (function () { new Reporter().report(); })();',
				},
			],
		});

		expect({
			exit_code: result.exit_code,
			async_failure: result.stdout.includes("async sentinel"),
			cli_ran: result.stdout.includes("cli sentinel"),
		}).toEqual({
			exit_code: 1,
			async_failure: true,
			cli_ran: false,
		});
	});

	test("preserves isolated TypeScript runtime errors for documentation diagnostics", () => {
		const sandbox = new DocumentationExampleSandbox(spawnSync);
		const result = sandbox.capture_output({
			...TYPESCRIPT_SANDBOX_EXAMPLE,
			source_files: [{ path: "cli.ts", text: 'throw new Error("example failure");' }],
		});
		expect(result).toEqual({ stdout: "Error: example failure", exit_code: 1 });
	});

	test("does not call object conversion hooks from the sandbox output callback", () => {
		const sandbox = new DocumentationExampleSandbox(spawnSync);
		const result = sandbox.capture_output({
			...TYPESCRIPT_SANDBOX_EXAMPLE,
			source_files: [
				{
					path: "src/output.ts",
					text: 'export class Output { public report(): void { console.log({ toString() { throw new Error("must not run"); } }); } }',
				},
				{
					path: "cli.ts",
					text: 'import { Output } from "src/output"; (function () { const output = new Output(); output.report(); })();',
				},
			],
		});

		expect(result).toEqual({ stdout: "[object]\n", exit_code: 0 });
	});

	test("executes TypeScript CLI entrypoints with a Node shebang", () => {
		const sandbox = new DocumentationExampleSandbox(spawnSync);
		const result = sandbox.capture_output({
			...TYPESCRIPT_SANDBOX_EXAMPLE,
			source_files: [
				{
					path: "src/output.ts",
					text: 'export class Output { public report(): void { console.log("ready"); } }',
				},
				{
					path: "cli.ts",
					text: '#!/usr/bin/env node\nimport { Output } from "src/output"; (function () { const output = new Output(); output.report(); })();',
				},
			],
		});

		expect(result).toEqual({ stdout: "ready\n", exit_code: 0 });
	});
});
