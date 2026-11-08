import { spawnSync } from "node:child_process";
import { describe, expect, test } from "@jest/globals";
import { DocumentationExampleSandbox } from "documentation_validation/sandbox/documentation_example_sandbox";
import { TYPESCRIPT_SANDBOX_EXAMPLE } from "tests/documentation_validation/constants";

describe("TypeScript documentation test hooks", () => {
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
					path: "src/reporter.ts",
					text: 'export class Reporter { public report(): void { console.log("ready"); } }',
				},
				{
					path: "tests/hooks.test.ts",
					text: 'const events: string[] = []; describe("parent", () => { beforeEach(() => events.push("parent")); describe("child", () => { beforeEach(() => events.push("child")); test("runs parent setup before child setup", () => { expect(events.slice(-2)).toEqual(["parent", "child"]); }); }); describe("sibling", () => { beforeEach(() => events.push("sibling")); test("does not run the other child setup", () => { expect(events.slice(-2)).toEqual(["parent", "sibling"]); }); }); });',
				},
				{
					path: "cli.ts",
					text: 'import { Reporter } from "src/reporter"; (function () { new Reporter().report(); })();',
				},
			],
		});

		expect(result).toEqual({ stdout: "ready\n", exit_code: 0 });
	});
});
