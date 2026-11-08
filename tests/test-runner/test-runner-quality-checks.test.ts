import "src/core/lint_project_context_creator";
import "src/lint_stage_timer";
import { PassThrough } from "node:stream";
import { describe, expect, test } from "@jest/globals";
import { TestExecution } from "test-runner/test_execution";
import { CommandExecutionTestDouble } from "tests/core/command_execution_test_double";
import { PROJECT_ROOT } from "tests/core/constants";

describe("test runner quality checks", () => {
	test("uses the repository root when the test runner has no explicit root", () => {
		const output = { stdout: new PassThrough(), stderr: new PassThrough() };
		const execution = new TestExecution(PROJECT_ROOT, new CommandExecutionTestDouble([]), output);
		execution.run_args(["--help"]);

		const help_output = output.stdout.read();
		expect(String(help_output)).toContain(`Usage: pnpm exec tsx ${PROJECT_ROOT}/test-runner/cli.ts`);
	});

	test("does not run quality checks after a failed TypeScript test command", () => {
		const runner = new CommandExecutionTestDouble([0, 3, 0]);
		const output = { stdout: new PassThrough(), stderr: new PassThrough() };
		const execution = new TestExecution(PROJECT_ROOT, runner, output);
		const exit_code = execution.run_args(["--headless"]);
		const output_text = output.stdout.read();
		const snapshot = runner.snapshot();
		const calls = [...snapshot.calls];

		expect({
			calls,
			exit_code,
			success_message: String(output_text).includes("All tests passed!"),
		}).toEqual({
			calls: [
				["python3", "-m", "pytest", `${PROJECT_ROOT}/tests/python-bridge`, `${PROJECT_ROOT}/tests/performance`],
				["pnpm", "--dir", PROJECT_ROOT, "exec", "jest"],
			],
			exit_code: 3,
			success_message: false,
		});
	});

	test("stops the complete runner before quality checks after a failed test command", () => {
		const runner = new CommandExecutionTestDouble([3]);
		const output = { stdout: new PassThrough(), stderr: new PassThrough() };
		const execution = new TestExecution(PROJECT_ROOT, runner, output);
		const exit_code = execution.run_args(["--headless"]);
		const output_text = output.stdout.read();
		const snapshot = runner.snapshot();
		const calls = [...snapshot.calls];

		expect({
			calls,
			exit_code,
			success_message: String(output_text).includes("All tests passed!"),
		}).toEqual({
			calls: [["python3", "-m", "pytest", `${PROJECT_ROOT}/tests/python-bridge`, `${PROJECT_ROOT}/tests/performance`]],
			exit_code: 3,
			success_message: false,
		});
	});

	test("returns a quality command failure without printing success", () => {
		const runner = new CommandExecutionTestDouble([0, 0, 0, 3]);
		const output = { stdout: new PassThrough(), stderr: new PassThrough() };
		const execution = new TestExecution(PROJECT_ROOT, runner, output);
		const exit_code = execution.run_args(["--headless"]);
		const output_text = output.stdout.read();
		const snapshot = runner.snapshot();

		expect({
			exit_code,
			command_count: snapshot.calls.length,
			success_message: String(output_text).includes("All tests passed!"),
		}).toEqual({
			exit_code: 3,
			command_count: 4,
			success_message: false,
		});
	});

	test("runs quality checks after tests and reports successful completion", () => {
		const runner = new CommandExecutionTestDouble([0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0]);
		const output = { stdout: new PassThrough(), stderr: new PassThrough() };
		const execution = new TestExecution(PROJECT_ROOT, runner, output);
		const exit_code = execution.run_args(["--headless", "--force-review", "--review-agent", "codex"]);
		const snapshot = runner.snapshot();
		const calls = [...snapshot.calls];
		const all_arguments = calls.flat();
		const quality_commands = calls.slice(2).map((call) => {
			if (call[0] === "python3") {
				return call[2];
			}
			if (call[0] === "vulture") {
				return call[0];
			}
			return call.slice(3, 5).join(" ");
		});

		expect({
			exit_code,
			success_message: String(output.stdout.read()).includes("All tests passed!"),
			test_commands: calls.slice(0, 2),
			quality_commands,
			review_options: all_arguments.filter((argument) =>
				["--force-review", "--review-agent", "codex"].includes(argument),
			),
		}).toEqual({
			exit_code: 0,
			success_message: true,
			test_commands: [
				["python3", "-m", "pytest", `${PROJECT_ROOT}/tests/python-bridge`, `${PROJECT_ROOT}/tests/performance`],
				["pnpm", "--dir", PROJECT_ROOT, "exec", "jest"],
			],
			quality_commands: [
				"exec biome",
				"exec biome",
				"exec tsc",
				"exec biome",
				"black",
				"ruff",
				"pyflakes",
				"mypy",
				"vulture",
				"lint --",
				"validate:rule-docs",
			],
			review_options: ["--force-review", "--review-agent", "codex"],
		});
	});
});
