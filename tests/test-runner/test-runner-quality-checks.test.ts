import "src/core/project-context/lint_project_context_creator";
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
		expect(String(help_output)).toContain("--skip-tests");
	});

	test("runs quality checks before stopping at a failed TypeScript test command", () => {
		const runner = new CommandExecutionTestDouble([...Array.from({ length: 11 }, () => 0), 0, 3]);
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
			calls: expect.arrayContaining([
				["python3", "-m", "pytest", `${PROJECT_ROOT}/tests/python-bridge`, `${PROJECT_ROOT}/tests/performance`],
				["pnpm", "--dir", PROJECT_ROOT, "exec", "jest"],
			]),
			exit_code: 3,
			success_message: false,
		});
	});

	test("runs all quality checks and skips both test suites when requested", () => {
		const runner = new CommandExecutionTestDouble(Array.from({ length: 11 }, () => 0));
		const output = { stdout: new PassThrough(), stderr: new PassThrough() };
		const execution = new TestExecution(PROJECT_ROOT, runner, output);
		const exit_code = execution.run_args(["--headless", "--skip-tests"]);
		const calls = runner.snapshot().calls;
		const output_text = String(output.stdout.read());

		expect({
			exit_code,
			call_count: calls.length,
			test_commands: calls.filter((call) => call.includes("pytest") || call.includes("jest")),
			skip_message: output_text.includes("Tests skipped by request."),
		}).toEqual({ exit_code: 0, call_count: 11, test_commands: [], skip_message: true });
	});

	test("stops before tests when a quality check fails", () => {
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
			calls: [
				[
					"pnpm",
					"--dir",
					PROJECT_ROOT,
					"exec",
					"biome",
					"check",
					"--write",
					"--organize-imports-enabled=true",
					"--formatter-enabled=false",
					"--linter-enabled=false",
					`${PROJECT_ROOT}/documentation_validation`,
					`${PROJECT_ROOT}/test-runner`,
					`${PROJECT_ROOT}/src`,
					`${PROJECT_ROOT}/tests`,
				],
			],
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

	test("runs all quality checks before tests and reports successful completion", () => {
		const runner = new CommandExecutionTestDouble([0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0]);
		const output = { stdout: new PassThrough(), stderr: new PassThrough() };
		const execution = new TestExecution(PROJECT_ROOT, runner, output);
		const exit_code = execution.run_args(["--headless", "--force-review", "--review-agent", "codex"]);
		const snapshot = runner.snapshot();
		const calls = [...snapshot.calls];
		const all_arguments = calls.flat();
		const quality_commands = calls.slice(0, 11).map((call) => {
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
			test_commands: calls.slice(-2),
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
