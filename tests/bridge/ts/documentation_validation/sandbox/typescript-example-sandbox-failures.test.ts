import { spawnSync } from "node:child_process";
import { describe, expect, test } from "@jest/globals";
import { DocumentationExampleSandbox } from "documentation_validation/sandbox/documentation_example_sandbox";
import { TYPESCRIPT_SANDBOX_EXAMPLE } from "tests/documentation_validation/constants";

describe("TypeScript documentation example failures", () => {
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
