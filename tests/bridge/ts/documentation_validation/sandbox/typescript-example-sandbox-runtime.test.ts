import { spawnSync } from "node:child_process";
import { describe, expect, test } from "@jest/globals";
import { DocumentationExampleSandbox } from "documentation_validation/sandbox/documentation_example_sandbox";
import { TYPESCRIPT_SANDBOX_EXAMPLE } from "tests/documentation_validation/constants";

describe("TypeScript documentation example runtime", () => {
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
});
