import { describe, expect, jest, test } from "@jest/globals";
import "src/core/lint_project_context_creator";
import type { CommandResult, CommandSpawnContract } from "test-runner/types";
import { CommandExecution } from "test-runner/command_execution";

describe("command execution result normalization", () => {
	test("forwards the child environment and working directory", () => {
		let observed_options: Parameters<CommandSpawnContract>[2] = {};
		const spawn_sync = jest.fn<CommandSpawnContract>().mockImplementation((_command, _args, options) => {
			observed_options = options;
			return {
				pid: 1,
				output: [null],
				stdout: Buffer.from(""),
				stderr: Buffer.from(""),
				status: 0,
				signal: null,
			};
		});
		const environment = { ...process.env, AI_CODE_GUARD_TEST_CONTEXT: "sentinel" };
		const execution = new CommandExecution(spawn_sync);
		execution.run("tool", ["--probe"], environment, "/project");

		expect({
			environment: observed_options.env,
			cwd: observed_options.cwd,
			stdio: observed_options.stdio,
			shell: observed_options.shell,
		}).toEqual({ environment, cwd: "/project", stdio: "inherit", shell: false });
	});

	test("reports a signaled child as failed", () => {
		const spawn_sync = jest.fn<CommandSpawnContract>().mockReturnValue({
			pid: 1,
			output: [null],
			stdout: Buffer.from(""),
			stderr: Buffer.from(""),
			status: null,
			signal: "SIGTERM",
		});

		const execution = new CommandExecution(spawn_sync);
		const result: CommandResult = execution.run("tool", [], {}, "/tmp");

		expect(result).toEqual({ status: 1, error_message: "" });
	});

	test("preserves a normal successful exit", () => {
		const spawn_sync = jest.fn<CommandSpawnContract>().mockReturnValue({
			pid: 1,
			output: [null],
			stdout: Buffer.from(""),
			stderr: Buffer.from(""),
			status: 0,
			signal: null,
		});

		const execution = new CommandExecution(spawn_sync);
		const result: CommandResult = execution.run("tool", [], {}, "/tmp");

		expect(result).toEqual({ status: 0, error_message: "" });
	});

	test("reports a missing executable as failed", () => {
		const spawn_sync = jest.fn<CommandSpawnContract>().mockReturnValue({
			pid: -1,
			output: [null],
			stdout: Buffer.from(""),
			stderr: Buffer.from(""),
			status: null,
			signal: null,
			error: new Error("ENOENT"),
		});

		const execution = new CommandExecution(spawn_sync);
		const result: CommandResult = execution.run("missing-tool", [], {}, "/tmp");

		expect(result).toEqual({ status: 1, error_message: "ENOENT" });
	});
});
