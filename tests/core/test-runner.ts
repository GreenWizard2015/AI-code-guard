import { spawnSync } from "node:child_process";
import { QualityCheckProcess } from "tests/core/quality-checks";
import type { TestRunnerRequest } from "tests/core/types";
import { PROJECT_ROOT } from "tests/core/constants";

/** Responsibilities: _and check execution testing_. **/
export class TestExecution {
	private readonly project_root: string;
	private readonly quality_checks: QualityCheckProcess;

	/** Responsibilities: _child commands execution_. **/
	private run_command(
		command: string,
		args: readonly string[],
		env: NodeJS.ProcessEnv,
	): void {
		const result = spawnSync(command, [...args], {
			env,
			stdio: "inherit",
			shell: false,
		});
		if (result.error !== undefined) {
			process.stderr.write(
				`Failed to start ${command}: ${result.error.message}\n`,
			);
			process.exit(1);
		}
		if (result.status !== 0) {
			let exit_status = result.status;
			if (exit_status === null) {
				exit_status = 1;
			}
			process.exit(exit_status);
		}
	}

	/** Responsibilities: _environment creation testing_. **/
	private create_env(headless: boolean): NodeJS.ProcessEnv {
		let ci = "false";
		if (headless) {
			ci = "true";
		}
		return { ...process.env, CI: ci };
	}

	/** Responsibilities: _command option parsing_. **/
	private apply_arg(
		request: TestRunnerRequest,
		arg: string,
	): TestRunnerRequest {
		if (arg === "--") {
			return request;
		}
		if (arg === "--help") {
			return { ...request, help_requested: true };
		}
		if (arg === "--headless") {
			return { ...request, headless: true };
		}
		if (arg === "--skip-quality") {
			return { ...request, skip_quality: true };
		}
		return { ...request, args: [...request.args, arg] };
	}

	/** Responsibilities: _runner options parsing_. **/
	private request_from_args(args: readonly string[]): TestRunnerRequest {
		const initial_request: TestRunnerRequest = {
			args: [],
			help_requested: false,
			headless: false,
			skip_quality: false,
		};
		return args.reduce(
			(request, arg) => this.apply_arg(request, arg),
			initial_request,
		);
	}

	/** Responsibilities: _usage text rendering_. **/
	private help_text(): string {
		return `
Usage: pnpm exec tsx ${this.project_root}/test-runner.ts [options] [jest options]

Runs the repository tests and then the TypeScript/Python formatters and quality checks.

Options:
  --headless         Run tests in headless CI mode
  --skip-quality     Skip formatters and quality checks
  --help             Show this help message

Examples:
  pnpm exec tsx ${this.project_root}/test-runner.ts
  pnpm exec tsx ${this.project_root}/test-runner.ts --runInBand
  pnpm exec tsx ${this.project_root}/test-runner.ts --headless
  pnpm exec tsx ${this.project_root}/test-runner.ts --skip-quality
`;
	}

	/** Responsibilities: _print runner status_. **/
	private print_start(headless: boolean): void {
		process.stdout.write(`🖥️  Mode: ${headless ? "Headless" : "UI"}\n`);
		process.stdout.write("\n");
		process.stdout.write("📦 Preparing test dependencies...\n");
	}

	/** Responsibilities: _quality checks execution_. **/
	private run_quality_checks(skip_quality: boolean): void {
		if (skip_quality) {
			return;
		}
		if (!this.quality_checks.available_checks()) {
			return;
		}
		this.quality_checks.run();
	}

	/** Responsibilities: _environment selection testing_. **/
	private test_environment(
		...environments: NodeJS.ProcessEnv[]
	): NodeJS.ProcessEnv {
		if (environments.length === 0) {
			return process.env;
		}
		return environments[0];
	}

	/** Responsibilities: _dependencies installation_. **/
	private install_dependencies(env: NodeJS.ProcessEnv): void {
		if (env.CI === "true") {
			return;
		}
		this.run_command("pnpm", ["--dir", this.project_root, "install"], env);
	}

	/** Responsibilities: _runner state initialization_. **/
	constructor(project_root: string = "") {
		if (project_root === undefined) {
			this.project_root = PROJECT_ROOT;
		} else {
			this.project_root = project_root;
		}
		this.quality_checks = new QualityCheckProcess(this.project_root);
	}

	/** Responsibilities: _tests execution_. **/
	public run_tests(
		args: readonly string[],
		...environments: NodeJS.ProcessEnv[]
	): void {
		const test_env = this.test_environment(...environments);
		this.install_dependencies(test_env);
		this.run_command(
			"pnpm",
			["--dir", this.project_root, "test", ...args],
			test_env,
		);
	}

	/** Responsibilities: _runner requests handling_. **/
	public run(request: TestRunnerRequest): void {
		if (request.help_requested) {
			process.stdout.write(this.help_text());
			return;
		}
		const headless = request.headless === true;
		const env = this.create_env(headless);
		this.print_start(headless);
		this.run_tests(request.args, env);
		this.run_quality_checks(request.skip_quality === true);
		process.stdout.write("\n✅ All tests passed!\n");
	}

	/** Responsibilities: _raw arguments parsing_. **/
	public run_args(args: readonly string[]): void {
		this.run(this.request_from_args(args));
	}
}
