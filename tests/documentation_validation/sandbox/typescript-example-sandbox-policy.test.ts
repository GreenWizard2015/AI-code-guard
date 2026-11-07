import { spawnSync } from "node:child_process";
import { describe, expect, test } from "@jest/globals";
import { DocumentationExampleSandbox } from "documentation_validation/sandbox/documentation_example_sandbox";
import { TYPESCRIPT_SANDBOX_EXAMPLE } from "tests/documentation_validation/constants";

describe("TypeScript example sandbox policy", () => {
	test("rejects output emitted during TypeScript module import", () => {
		const example = {
			...TYPESCRIPT_SANDBOX_EXAMPLE,
			source_files: [
				{ path: "src/documentation_output.ts", text: 'console.log("example");' },
				{ path: "cli.ts", text: 'import "src/documentation_output";' },
			],
		};
		const result_sandbox = new DocumentationExampleSandbox(spawnSync);
		const result = result_sandbox.capture_output(example);

		expect(result).toEqual({
			stdout: "src/documentation_output.ts: imported modules must write output from a called function or method",
			exit_code: 1,
		});
	});

	test("executes literal dynamic imports from example modules and waits for their output", () => {
		const example = {
			...TYPESCRIPT_SANDBOX_EXAMPLE,
			source_files: [
				{
					path: "src/reporter.ts",
					text: 'export class Reporter { public async report(): Promise<void> { const item = await import("src/item"); console.log(new item.Item().label()); } }',
				},
				{ path: "src/item.ts", text: 'export class Item { public label(): string { return "ready"; } }' },
				{
					path: "cli.ts",
					text: 'import { Reporter } from "src/reporter"; (async function () { const reporter = new Reporter(); await reporter.report(); })();',
				},
			],
		};
		const result_sandbox = new DocumentationExampleSandbox(spawnSync);
		const result = result_sandbox.capture_output(example);

		expect(result).toEqual({ stdout: "ready\n", exit_code: 0 });
	});

	test("rejects dynamic imports outside the in-memory example sources", () => {
		const example = {
			...TYPESCRIPT_SANDBOX_EXAMPLE,
			source_files: [{ path: "cli.ts", text: 'void import("node:fs");' }],
		};
		const result_sandbox = new DocumentationExampleSandbox(spawnSync);
		const result = result_sandbox.capture_output(example);

		expect(result).toEqual({
			stdout: "cli.ts: dynamic imports must target an example source module",
			exit_code: 1,
		});
	});

	test("rejects output written directly by a TypeScript CLI entrypoint", () => {
		const example = {
			...TYPESCRIPT_SANDBOX_EXAMPLE,
			source_files: [{ path: "cli.ts", text: 'console.log("ready");' }],
		};

		const sandbox = new DocumentationExampleSandbox(spawnSync);
		const result = sandbox.capture_output(example);
		expect(result).toEqual({
			stdout: "cli.ts: CLI entrypoints must not write output",
			exit_code: 1,
		});
	});

	test("rejects external TypeScript modules before evaluating the example", () => {
		const example = {
			...TYPESCRIPT_SANDBOX_EXAMPLE,
			source_files: [{ path: "cli.ts", text: 'import { readFile } from "node:fs"; void readFile;' }],
		};

		const sandbox = new DocumentationExampleSandbox(spawnSync);
		const result = sandbox.capture_output(example);
		expect(result).toEqual({
			stdout: "cli.ts: external module access is not allowed",
			exit_code: 1,
		});
	});

	test("rejects TypeScript network access before evaluating the example", () => {
		const example = {
			...TYPESCRIPT_SANDBOX_EXAMPLE,
			source_files: [
				{ path: "domain/request.ts", text: 'fetch("https://example.invalid");' },
				{ path: "cli.ts", text: 'import "./domain/request";' },
			],
		};
		const result_sandbox = new DocumentationExampleSandbox(spawnSync);
		const result = result_sandbox.capture_output(example);

		expect(result).toEqual({ stdout: "domain/request.ts: access to fetch is not allowed", exit_code: 1 });
	});

	test("rejects computed access to host module-loader properties before evaluation", () => {
		const example = {
			...TYPESCRIPT_SANDBOX_EXAMPLE,
			source_files: [
				{
					path: "domain/probe.ts",
					text: 'export function probe(): void { const constructor = require["con" + "structor"]; console.log(constructor("return typeof process")()); }',
				},
				{ path: "cli.ts", text: 'import "./domain/probe";' },
			],
		};

		const sandbox = new DocumentationExampleSandbox(spawnSync);
		const result = sandbox.capture_output(example);

		expect(result).toEqual({
			stdout: "domain/probe.ts: computed module-loader access is not allowed",
			exit_code: 1,
		});
	});

	test("rejects direct and literal host module require access before evaluation", () => {
		const example = {
			...TYPESCRIPT_SANDBOX_EXAMPLE,
			source_files: [
				{ path: "domain/direct.ts", text: 'module.require("node:fs");' },
				{ path: "domain/literal.ts", text: 'module["require"]("node:fs");' },
				{ path: "cli.ts", text: 'import "./domain/direct"; import "./domain/literal";' },
			],
		};
		const result_sandbox = new DocumentationExampleSandbox(spawnSync);
		const result = result_sandbox.capture_output(example);

		expect(result).toEqual({
			stdout:
				"domain/direct.ts: access to the host module loader is not allowed\ndomain/literal.ts: access to the host module loader is not allowed",
			exit_code: 1,
		});
	});

	test("rejects blocking Atomics access before evaluating an imported module", () => {
		const example = {
			...TYPESCRIPT_SANDBOX_EXAMPLE,
			source_files: [
				{
					path: "domain/probe.ts",
					text: 'export function probe(): void { Atomics.wait(new Int32Array(new SharedArrayBuffer(4)), 0, 0); console.log("blocked"); }',
				},
				{ path: "cli.ts", text: 'import "./domain/probe";' },
			],
		};
		const result_sandbox = new DocumentationExampleSandbox(spawnSync);
		const result = result_sandbox.capture_output(example);

		expect(result).toEqual({
			stdout:
				"domain/probe.ts: access to Atomics is not allowed\ndomain/probe.ts: access to SharedArrayBuffer is not allowed",
			exit_code: 1,
		});
	});

	test("cannot reach Node through VM function constructors", () => {
		const loader_escape = {
			...TYPESCRIPT_SANDBOX_EXAMPLE,
			source_files: [
				{
					path: "domain/probe.ts",
					text: 'const constructor = Object.getPrototypeOf(require)["con" + "structor"]; console.log(constructor("return typeof process")());',
				},
				{ path: "cli.ts", text: 'import "./domain/probe";' },
			],
		};
		const output_escape = {
			...TYPESCRIPT_SANDBOX_EXAMPLE,
			source_files: [
				{
					path: "domain/probe.ts",
					text: 'const constructor = Object.getPrototypeOf(console.log)["con" + "structor"]; console.log(constructor("return typeof process")());',
				},
				{ path: "cli.ts", text: 'import "./domain/probe";' },
			],
		};

		const loader_result_sandbox = new DocumentationExampleSandbox(spawnSync);
		const loader_result = loader_result_sandbox.capture_output(loader_escape);
		const output_result_sandbox = new DocumentationExampleSandbox(spawnSync);
		const output_result = output_result_sandbox.capture_output(output_escape);
		const results = [loader_result, output_result];
		const messages = results.map(({ stdout }) => stdout);

		expect({
			codes: results.map(({ exit_code }) => exit_code),
			dynamic_access_blocked: messages.every((message) => message.includes("dynamic property access is not allowed")),
			prototype_inspection_blocked: messages.every((message) =>
				message.includes("runtime prototype inspection is not allowed"),
			),
		}).toEqual({
			codes: [1, 1],
			dynamic_access_blocked: true,
			prototype_inspection_blocked: true,
		});
	});

	test("does not expose host exceptions when example output exceeds the limit", () => {
		const example = {
			...TYPESCRIPT_SANDBOX_EXAMPLE,
			source_files: [
				{
					path: "domain/probe.ts",
					text: 'export function probe(): void { try { console.log("x".repeat(65537)); } catch (error) { console.log("caught"); } console.log("finished"); }',
				},
				{ path: "cli.ts", text: 'import { probe } from "./domain/probe"; probe();' },
			],
		};

		const result_sandbox = new DocumentationExampleSandbox(spawnSync);
		const result = result_sandbox.capture_output(example);

		expect(result).toEqual({ stdout: "Documentation example output exceeded the sandbox limit.", exit_code: 1 });
	});
});
