import "src/core/lint_project_context_creator";
import "src/lint_stage_timer";
import { delimiter } from "node:path";
import { PassThrough } from "node:stream";
import { describe, expect, test } from "@jest/globals";
import { NODE_VM_MODULES_ARGUMENT } from "test-runner/constants";
import { TestExecution } from "test-runner/test_execution";
import { CommandExecutionTestDouble } from "tests/core/command_execution_test_double";
import { PROJECT_ROOT } from "tests/core/constants";

describe("test execution commands", () => {
	test("stops when dependency installation fails", () => {
		const runner = new CommandExecutionTestDouble([3]);
		const execution = new TestExecution(PROJECT_ROOT, runner, { stdout: new PassThrough(), stderr: new PassThrough() });
		const exit_code = execution.run_tests([], { ...process.env, CI: "false" });

		expect({ exit_code, calls: runner.snapshot().calls }).toEqual({
			exit_code: 3,
			calls: [["pnpm", "--dir", PROJECT_ROOT, "install"]],
		});
	});

	test("installs dependencies before running both test suites", () => {
		const runner = new CommandExecutionTestDouble([0, 0, 0]);
		const execution = new TestExecution(PROJECT_ROOT, runner, { stdout: new PassThrough(), stderr: new PassThrough() });
		const exit_code = execution.run_tests([], { ...process.env, CI: "false" });

		expect({ exit_code, calls: runner.snapshot().calls }).toEqual({
			exit_code: 0,
			calls: [
				["pnpm", "--dir", PROJECT_ROOT, "install"],
				["python3", "-m", "pytest", `${PROJECT_ROOT}/tests/python-bridge`, `${PROJECT_ROOT}/tests/performance`],
				["pnpm", "--dir", PROJECT_ROOT, "exec", "jest"],
			],
		});
	});

	test("forwards Python bridge paths and project working directories", () => {
		const python_path_key = "PYTHONPATH";
		const runner = new CommandExecutionTestDouble([0, 0]);
		const execution = new TestExecution(PROJECT_ROOT, runner, { stdout: new PassThrough(), stderr: new PassThrough() });
		const exit_code = execution.run_tests([], { ...process.env, CI: "true" });
		const snapshot = runner.snapshot();
		const python_environment = snapshot.environments[0];
		let python_path: string | undefined;
		if (python_environment !== undefined) {
			python_path = python_environment[python_path_key];
		}
		expect({
			exit_code,
			python_path,
			working_directories: snapshot.working_directories,
		}).toEqual({
			exit_code: 0,
			python_path: [`${PROJECT_ROOT}/src/python-bridge`, `${PROJECT_ROOT}/tests/python-bridge`].join(delimiter),
			working_directories: [PROJECT_ROOT, PROJECT_ROOT],
		});
	});

	test("preserves inherited CI mode when quality checks are skipped", () => {
		const runner = new CommandExecutionTestDouble([0, 0]);
		const ci_key = "CI";
		const previous_ci = process.env[ci_key];
		process.env[ci_key] = "true";
		const execution = new TestExecution(PROJECT_ROOT, runner, { stdout: new PassThrough(), stderr: new PassThrough() });
		try {
			execution.run_args(["--skip-quality"]);
		} finally {
			if (previous_ci === undefined) {
				delete process.env[ci_key];
			} else {
				process.env[ci_key] = previous_ci;
			}
		}
		const snapshot = runner.snapshot();
		expect({
			calls: snapshot.calls,
			ci_values: snapshot.environments.map((environment) => environment[ci_key]),
		}).toEqual({
			calls: [
				["python3", "-m", "pytest", `${PROJECT_ROOT}/tests/python-bridge`, `${PROJECT_ROOT}/tests/performance`],
				["pnpm", "--dir", PROJECT_ROOT, "exec", "jest"],
			],
			ci_values: ["true", "true"],
		});
	});

	test("preserves inherited Node options when adding the Jest VM option", () => {
		const node_options_key = "NODE_OPTIONS";
		const inherited_node_option = "--trace-warnings";
		const runner = new CommandExecutionTestDouble([0, 0]);
		const execution = new TestExecution(PROJECT_ROOT, runner, { stdout: new PassThrough(), stderr: new PassThrough() });
		const exit_code = execution.run_tests([], {
			...process.env,
			CI: "true",
			NODE_OPTIONS: inherited_node_option,
		});
		const snapshot = runner.snapshot();
		const commands_and_node_options = snapshot.calls.map((call, index) => {
			const environment = snapshot.environments[index];
			let node_options: string | undefined;
			if (environment !== undefined) {
				node_options = environment[node_options_key];
			}
			return [call[0], node_options];
		});

		expect({
			exit_code,
			commands_and_node_options,
		}).toEqual({
			exit_code: 0,
			commands_and_node_options: [
				["python3", inherited_node_option],
				["pnpm", `${inherited_node_option} ${NODE_VM_MODULES_ARGUMENT}`],
			],
		});
	});

	test("sets the Jest VM option when inherited Node options are unset", () => {
		const node_options_key = "NODE_OPTIONS";
		const environment: NodeJS.ProcessEnv = { ...process.env, CI: "true" };
		delete environment[node_options_key];
		const runner = new CommandExecutionTestDouble([0, 0]);
		const execution = new TestExecution(PROJECT_ROOT, runner, { stdout: new PassThrough(), stderr: new PassThrough() });
		execution.run_tests([], environment);
		const snapshot = runner.snapshot();

		expect(snapshot.environments.map((child_environment) => child_environment[node_options_key])).toEqual([
			undefined,
			NODE_VM_MODULES_ARGUMENT,
		]);
	});
});
