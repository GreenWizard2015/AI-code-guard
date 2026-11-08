import { delimiter, join, resolve } from "node:path";
import type { QualityCheckRunnerContract } from "src/task_types";
import {
	JEST_EXECUTABLE,
	NODE_VM_MODULES_ARGUMENT,
	PACKAGE_MANAGER,
	PERFORMANCE_TEST_DIRECTORY,
	PYTEST_MODULE,
	PYTHON_BRIDGE_DIRECTORY,
	PYTHON_EXECUTABLE,
	PYTHON_TEST_DIRECTORY,
} from "test-runner/constants";
import { QualityCheckProcess } from "test-runner/quality_check_process";
import { TestRunnerArguments } from "test-runner/test_runner_arguments";
import type { CommandRunnerContract, TestRunnerOutput, TestRunnerRequest } from "test-runner/types";

/** Responsibilities: _quality check execution_, _test environment preparation_. **/
export class TestExecution {
	private readonly _project_root: string;
	private readonly _quality_checks: QualityCheckRunnerContract;
	private readonly _command_runner: CommandRunnerContract;
	private readonly _output: TestRunnerOutput;

	/** Responsibilities: _child commands execution_. **/
	private run_command(
		command: string,
		command_arguments: readonly string[],
		command_environment: NodeJS.ProcessEnv,
	): number {
		const result = this._command_runner.run(command, command_arguments, command_environment, this._project_root);
		if (result.error_message.length > 0) {
			this._output.stderr.write(`Failed to start ${command}: ${result.error_message}\n`);
			return 1;
		}
		return result.status;
	}

	/** Responsibilities: _environment creation testing_. **/
	private effective_headless(headless: boolean): boolean {
		if (headless) {
			return true;
		}
		const ci_key = "CI";
		const inherited_ci = process.env[ci_key];
		if (inherited_ci === "true") {
			return true;
		}
		return false;
	}

	/** Responsibilities: _usage text rendering_. **/
	private help_text(): string {
		return `
Usage: pnpm exec tsx ${this._project_root}/test-runner/cli.ts [options] [jest options]

Runs the repository tests and then the TypeScript/Python formatters and quality checks.

Options:
  --headless         Run tests in headless CI mode
  --skip-quality     Skip formatters and quality checks
	  --force-review    Force a review only when a review agent is selected
	--review-agent     Select codex, cx, cxa, or claude. No selection means no review.
  --help             Show this help message

Examples:
  pnpm exec tsx ${this._project_root}/test-runner/cli.ts
  pnpm exec tsx ${this._project_root}/test-runner/cli.ts --runInBand
  pnpm exec tsx ${this._project_root}/test-runner/cli.ts --headless
  pnpm exec tsx ${this._project_root}/test-runner/cli.ts --headless --force-review
  pnpm exec tsx ${this._project_root}/test-runner/cli.ts --skip-quality
`;
	}

	/** Responsibilities: _print runner status_. **/
	private print_start(headless: boolean): void {
		this._output.stdout.write(`🖥  Mode: ${this.effective_headless(headless) ? "Headless" : "UI"}\n`);
		this._output.stdout.write("\n");
		this._output.stdout.write("📦 Preparing test dependencies...\n");
	}

	/** Responsibilities: _test workflow environment_, _test command execution_. **/
	private execute_test_workflow(headless_mode: boolean, test_arguments: readonly string[]): number {
		const environment = { ...process.env, CI: this.effective_headless(headless_mode) ? "true" : "false" };
		this.print_start(headless_mode);
		return this.run_tests(test_arguments, environment);
	}

	/** Responsibilities: _environment selection testing_. **/
	private test_environment(...environment_candidates: NodeJS.ProcessEnv[]): NodeJS.ProcessEnv {
		if (environment_candidates.length === 0) {
			return process.env;
		}
		const environment = environment_candidates.at(0);
		if (environment === undefined) {
			return process.env;
		}
		return environment;
	}

	/** Responsibilities: _dependencies installation_. **/
	private install_dependencies(environment: NodeJS.ProcessEnv): number {
		const ci_key = "CI";
		if (environment[ci_key] === "true") {
			return 0;
		}
		return this.run_command("pnpm", ["--dir", this._project_root, "install"], environment);
	}

	/** Responsibilities: _Python test environment_. **/
	private python_test_environment(parent_environment: NodeJS.ProcessEnv): NodeJS.ProcessEnv {
		return {
			...parent_environment,
			PYTHONPATH: [
				join(this._project_root, PYTHON_BRIDGE_DIRECTORY),
				join(this._project_root, PYTHON_TEST_DIRECTORY),
			].join(delimiter),
		};
	}

	/** Responsibilities: _TypeScript test execution_. **/
	private run_typescript_tests(jest_arguments: readonly string[], environment: NodeJS.ProcessEnv): number {
		const node_options_key = "NODE_OPTIONS";
		const node_options = [environment[node_options_key], NODE_VM_MODULES_ARGUMENT].filter(Boolean).join(" ");
		return this.run_command(
			PACKAGE_MANAGER,
			["--dir", this._project_root, "exec", JEST_EXECUTABLE, ...jest_arguments],
			{
				...environment,
				NODE_OPTIONS: node_options,
			},
		);
	}

	/** Responsibilities: _runner state initialization_. **/
	public constructor(project_root: string, command_runner: CommandRunnerContract, output: TestRunnerOutput) {
		this._project_root = resolve(project_root);
		this._command_runner = command_runner;
		this._output = output;
		this._quality_checks = new QualityCheckProcess(this._project_root, command_runner, output);
	}

	/** Responsibilities: _tests execution_. **/
	public run_tests(jest_arguments: readonly string[], ...environment_candidates: NodeJS.ProcessEnv[]): number {
		const test_environment = this.test_environment(...environment_candidates);
		const install_status = this.install_dependencies(test_environment);
		if (install_status !== 0) {
			return install_status;
		}
		const python_status = this.run_command(
			PYTHON_EXECUTABLE,
			[
				"-m",
				PYTEST_MODULE,
				join(this._project_root, PYTHON_TEST_DIRECTORY),
				join(this._project_root, PERFORMANCE_TEST_DIRECTORY),
			],
			this.python_test_environment(test_environment),
		);
		if (python_status !== 0) {
			return python_status;
		}
		return this.run_typescript_tests(jest_arguments, test_environment);
	}

	/** Responsibilities: _runner requests handling_. **/
	public run(request: TestRunnerRequest): number {
		if (request.help_requested) {
			this._output.stdout.write(this.help_text());
			return 0;
		}
		const test_status = this.execute_test_workflow(request.headless, request.args);
		if (test_status !== 0) {
			return test_status;
		}
		const quality_status = this._quality_checks.run_test_request(request);
		if (quality_status !== 0) {
			return quality_status;
		}
		this._output.stdout.write("\n✅ All tests passed!\n");
		return 0;
	}

	/** Responsibilities: _raw arguments parsing_. **/
	public run_args(args: readonly string[]): number {
		const parsed_arguments = new TestRunnerArguments(args);
		const request = parsed_arguments.request();
		return this.run(request);
	}
}
