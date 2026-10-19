import { delimiter, join, resolve } from "node:path";
import { PYTHON_BRIDGE_DIRECTORY, PYTHON_TEST_DIRECTORY } from "test-runner/constants";
import { QualityCheckProcess } from "test-runner/quality_check_process";
import { TestRunnerRequestArguments } from "test-runner/test_runner_request_arguments";
import type { QualityCheckProcessContract } from "src/protocols";
import type { CommandRunnerContract, QualityCheckExecutionOptions, TestRunnerRequest } from "test-runner/types";

/** Responsibilities: _quality check execution_, _test environment preparation_. **/
export class TestExecution {
	private readonly project_root: string;
	private readonly quality_checks: QualityCheckProcessContract;
	private readonly command_runner: CommandRunnerContract;

	/** Responsibilities: _child commands execution_. **/
	private run_command(command: string, args: readonly string[], env: NodeJS.ProcessEnv): boolean {
		const result = this.command_runner.run(command, args, env, this.project_root);
		if (result.error_message.length > 0) {
			process.stderr.write(`Failed to start ${command}: ${result.error_message}\n`);
			process.exitCode = 1;
			return false;
		}
		if (result.status !== 0) {
			process.exitCode = result.status;
			return false;
		}
		return true;
	}

	/** Responsibilities: _environment creation testing_. **/
	private effective_headless(headless: boolean): boolean {
		if (headless) {
			return true;
		}
		const inherited_ci = process.env.CI;
		if (inherited_ci === "true") {
			return true;
		}
		return false;
	}

	/** Responsibilities: _usage text rendering_. **/
	private help_text(): string {
		return `
Usage: pnpm exec tsx ${this.project_root}/test-runner/cli.ts [options] [jest options]

Runs the repository tests and then the TypeScript/Python formatters and quality checks.

Options:
  --headless         Run tests in headless CI mode
  --skip-quality     Skip formatters and quality checks
	  --force-review    Force a review only when a review agent is selected
	  --review-cleanup   Run cleanup dialogue after architecture review findings
	--review-agent     Select the architecture review agent (codex or claude). No selection means no review.
  --help             Show this help message

Examples:
  pnpm exec tsx ${this.project_root}/test-runner/cli.ts
  pnpm exec tsx ${this.project_root}/test-runner/cli.ts --runInBand
  pnpm exec tsx ${this.project_root}/test-runner/cli.ts --headless
  pnpm exec tsx ${this.project_root}/test-runner/cli.ts --headless --force-review
  pnpm exec tsx ${this.project_root}/test-runner/cli.ts --review-cleanup
  pnpm exec tsx ${this.project_root}/test-runner/cli.ts --skip-quality
`;
	}

	/** Responsibilities: _print runner status_. **/
	private print_start(headless: boolean): void {
		process.stdout.write(`🖥️  Mode: ${this.effective_headless(headless) ? "Headless" : "UI"}\n`);
		process.stdout.write("\n");
		process.stdout.write("📦 Preparing test dependencies...\n");
	}

	/** Responsibilities: _quality checks execution_. **/
	private run_quality_checks(options: QualityCheckExecutionOptions): void {
		if (options.skip_quality) {
			return;
		}
		if (!this.quality_checks.available_checks()) {
			return;
		}
		this.quality_checks.run(options);
	}

	/** Responsibilities: _requested quality execution_. **/
	private requested_quality_checks(request: TestRunnerRequest): void {
		this.run_quality_checks({
			skip_quality: request.skip_quality === true,
			force_review: request.force_review === true,
			review_cleanup: request.review_cleanup === true,
			review_agent: request.review_agent,
		});
	}

	/** Responsibilities: _environment selection testing_. **/
	private test_environment(...environments: NodeJS.ProcessEnv[]): NodeJS.ProcessEnv {
		if (environments.length === 0) {
			return process.env;
		}
		return environments[0];
	}

	/** Responsibilities: _dependencies installation_. **/
	private install_dependencies(env: NodeJS.ProcessEnv): boolean {
		if (env.CI === "true") {
			return true;
		}
		return this.run_command("pnpm", ["--dir", this.project_root, "install"], env);
	}

	/** Responsibilities: _Python test environment_. **/
	private python_test_environment(env: NodeJS.ProcessEnv): NodeJS.ProcessEnv {
		return {
			...env,
			PYTHONPATH: [
				join(this.project_root, PYTHON_BRIDGE_DIRECTORY),
				join(this.project_root, PYTHON_TEST_DIRECTORY),
			].join(delimiter),
		};
	}

	/** Responsibilities: _TypeScript test execution_. **/
	private run_typescript_tests(args: readonly string[], env: NodeJS.ProcessEnv): boolean {
		const node_options = [env.NODE_OPTIONS, "--experimental-vm-modules"].filter(Boolean).join(" ");
		return this.run_command("pnpm", ["--dir", this.project_root, "exec", "jest", "--maxWorkers=4", ...args], {
			...env,
			NODE_OPTIONS: node_options,
		});
	}

	/** Responsibilities: _runner state initialization_. **/
	constructor(project_root: string, command_runner: CommandRunnerContract) {
		this.project_root = resolve(project_root);
		this.command_runner = command_runner;
		this.quality_checks = new QualityCheckProcess(this.project_root, command_runner, process);
	}

	/** Responsibilities: _tests execution_. **/
	public run_tests(args: readonly string[], ...environments: NodeJS.ProcessEnv[]): boolean {
		const test_env = this.test_environment(...environments);
		if (!this.install_dependencies(test_env)) {
			return false;
		}
		const python_tests_passed = this.run_command(
			"python3",
			["-m", "pytest", join(this.project_root, PYTHON_TEST_DIRECTORY), join(this.project_root, "tests/performance")],
			this.python_test_environment(test_env),
		);
		if (!python_tests_passed) {
			return false;
		}
		return this.run_typescript_tests(args, test_env);
	}

	/** Responsibilities: _runner requests handling_. **/
	public run(request: TestRunnerRequest): void {
		if (request.help_requested) {
			process.stdout.write(this.help_text());
			return;
		}
		const headless = request.headless === true;
		const env = { ...process.env, CI: this.effective_headless(headless) ? "true" : "false" };
		this.print_start(headless);
		if (!this.run_tests(request.args, env)) {
			return;
		}
		this.requested_quality_checks(request);
		process.stdout.write("\n✅ All tests passed!\n");
	}

	/** Responsibilities: _raw arguments parsing_. **/
	public run_args(args: readonly string[]): void {
		const request_arguments = new TestRunnerRequestArguments(args);
		this.run(request_arguments.request());
	}
}
