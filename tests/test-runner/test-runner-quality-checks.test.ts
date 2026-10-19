import "src/core/lint_project_context_creator";
import "src/lint_stage_timer";
import { describe, expect, jest, test } from "@jest/globals";
import { delimiter } from "node:path";
import { TestExecution } from "test-runner/test_execution";
import { CommandExecutionTestDouble } from "tests/core/command_execution_test_double";
import { PROJECT_ROOT } from "tests/core/constants";

describe("test runner quality checks", () => {
	test("uses the repository root when the test runner has no explicit root", () => {
		const output: string[] = [];
		const write = jest.spyOn(process.stdout, "write").mockImplementation((chunk) => {
			output.push(String(chunk));
			return true;
		});
		try {
			const execution = new TestExecution(PROJECT_ROOT, new CommandExecutionTestDouble([]));
			execution.run_args(["--help"]);
		} finally {
			write.mockRestore();
		}

		expect(output.join("")).toContain(`Usage: pnpm exec tsx ${PROJECT_ROOT}/test-runner/cli.ts`);
	});

	test("stops after a failed Python command without starting TypeScript tests", () => {
		const runner = new CommandExecutionTestDouble([3]);
		const previous_exit_code = process.exitCode;
		const execution = new TestExecution(PROJECT_ROOT, runner);
		let observed_exit_code = -1;
		try {
			execution.run_tests([], { ...process.env, CI: "true" });
			if (typeof process.exitCode === "number") {
				observed_exit_code = process.exitCode;
			}
		} finally {
			process.exitCode = previous_exit_code;
		}
		expect({ exit_code: observed_exit_code, calls: runner.calls }).toEqual({
			exit_code: 3,
			calls: [["python3", "-m", "pytest", `${PROJECT_ROOT}/tests/python-bridge`, `${PROJECT_ROOT}/tests/performance`]],
		});
	});

	test("stops before tests when dependency installation fails", () => {
		const runner = new CommandExecutionTestDouble([3]);
		const previous_exit_code = process.exitCode;
		const execution = new TestExecution(PROJECT_ROOT, runner);
		let tests_started = true;
		try {
			tests_started = execution.run_tests([], { ...process.env, CI: "false" });
		} finally {
			process.exitCode = previous_exit_code;
		}

		expect({ tests_started, calls: runner.calls }).toEqual({
			tests_started: false,
			calls: [["pnpm", "--dir", PROJECT_ROOT, "install"]],
		});
	});

	test("installs dependencies before both test suites", () => {
		const runner = new CommandExecutionTestDouble([0, 0, 0]);
		const execution = new TestExecution(PROJECT_ROOT, runner);

		expect(execution.run_tests([], { ...process.env, CI: "false" })).toBe(true);
		expect(runner.calls).toEqual([
			["pnpm", "--dir", PROJECT_ROOT, "install"],
			["python3", "-m", "pytest", `${PROJECT_ROOT}/tests/python-bridge`, `${PROJECT_ROOT}/tests/performance`],
			["pnpm", "--dir", PROJECT_ROOT, "exec", "jest", "--maxWorkers=4"],
		]);
	});

	test("forwards the Python bridge import root and project cwd", () => {
		const runner = new CommandExecutionTestDouble([0, 0]);
		const execution = new TestExecution(PROJECT_ROOT, runner);

		expect(execution.run_tests([], { ...process.env, CI: "true" })).toBe(true);
		expect({
			python_path: runner.environments[0]?.PYTHONPATH,
			python_cwd: runner.working_directories[0],
			typescript_cwd: runner.working_directories[1],
		}).toEqual({
			python_path: [`${PROJECT_ROOT}/src/python-bridge`, `${PROJECT_ROOT}/tests/python-bridge`].join(delimiter),
			python_cwd: PROJECT_ROOT,
			typescript_cwd: PROJECT_ROOT,
		});
	});

	test("preserves inherited CI mode when headless was not passed", () => {
		const runner = new CommandExecutionTestDouble([0, 0, 0]);
		const previous_ci = process.env.CI;
		process.env.CI = "true";
		try {
			const execution = new TestExecution(PROJECT_ROOT, runner);
			execution.run_args(["--skip-quality"]);
		} finally {
			if (previous_ci === undefined) {
				delete process.env.CI;
			} else {
				process.env.CI = previous_ci;
			}
		}

		expect({
			calls: runner.calls,
			ci_values: runner.environments.map((environment) => environment.CI),
		}).toEqual({
			calls: [
				["python3", "-m", "pytest", `${PROJECT_ROOT}/tests/python-bridge`, `${PROJECT_ROOT}/tests/performance`],
				["pnpm", "--dir", PROJECT_ROOT, "exec", "jest", "--maxWorkers=4"],
			],
			ci_values: ["true", "true"],
		});
	});

	test("propagates a failed TypeScript test command after Python passes", () => {
		const runner = new CommandExecutionTestDouble([0, 3]);
		const previous_exit_code = process.exitCode;
		const execution = new TestExecution(PROJECT_ROOT, runner);
		let observed_exit_code = -1;
		try {
			execution.run_tests([], { ...process.env, CI: "true" });
			if (typeof process.exitCode === "number") {
				observed_exit_code = process.exitCode;
			}
		} finally {
			process.exitCode = previous_exit_code;
		}
		expect({ exit_code: observed_exit_code, calls: runner.calls }).toEqual({
			exit_code: 3,
			calls: [
				["python3", "-m", "pytest", `${PROJECT_ROOT}/tests/python-bridge`, `${PROJECT_ROOT}/tests/performance`],
				["pnpm", "--dir", PROJECT_ROOT, "exec", "jest", "--maxWorkers=4"],
			],
		});
	});

	test("does not run quality checks after a failed TypeScript test command", () => {
		const runner = new CommandExecutionTestDouble([0, 3, 0]);
		const output: string[] = [];
		const write = jest.spyOn(process.stdout, "write").mockImplementation((chunk) => {
			output.push(String(chunk));
			return true;
		});
		const previous_exit_code = process.exitCode;
		const execution = new TestExecution(PROJECT_ROOT, runner);
		try {
			execution.run_args(["--headless"]);
		} finally {
			write.mockRestore();
			process.exitCode = previous_exit_code;
		}

		expect({
			calls: runner.calls,
			exit_code: runner.exit_status,
			success_message: output.join("").includes("All tests passed!"),
		}).toEqual({
			calls: [
				["python3", "-m", "pytest", `${PROJECT_ROOT}/tests/python-bridge`, `${PROJECT_ROOT}/tests/performance`],
				["pnpm", "--dir", PROJECT_ROOT, "exec", "jest", "--maxWorkers=4"],
			],
			exit_code: -1,
			success_message: false,
		});
	});

	test("stops the complete runner before quality checks after a failed test command", () => {
		const runner = new CommandExecutionTestDouble([3]);
		const output: string[] = [];
		const write = jest.spyOn(process.stdout, "write").mockImplementation((chunk) => {
			output.push(String(chunk));
			return true;
		});
		const execution = new TestExecution(PROJECT_ROOT, runner);
		const previous_exit_code = process.exitCode;
		try {
			execution.run_args(["--headless"]);
		} finally {
			write.mockRestore();
			process.exitCode = previous_exit_code;
		}

		expect({
			calls: runner.calls,
			exit_code: runner.exit_status,
			success_message: output.join("").includes("All tests passed!"),
		}).toEqual({
			calls: [["python3", "-m", "pytest", `${PROJECT_ROOT}/tests/python-bridge`, `${PROJECT_ROOT}/tests/performance`]],
			exit_code: -1,
			success_message: false,
		});
	});
});
