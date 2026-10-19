import { QualityCheckDefinitions } from "test-runner/quality_check_definitions";
import type {
	CommandResult,
	ProcessExitContract,
	QualityCheck,
	CommandRunnerContract,
	QualityCheckRunOptions,
	QualityCheckArgument,
} from "test-runner/types";
import type { QualityCheckDefinitionsContract, QualityCheckProcessContract, QualityCheckContract } from "src/protocols";
import {
	FORCE_REVIEW_ARGUMENT,
	REVIEW_AGENT_OPTION,
	REVIEW_CLEANUP_ARGUMENT,
} from "test-runner/constants";

/** Responsibilities: _quality command execution_, _quality failure reporting_. **/
export class QualityCheckProcess implements QualityCheckProcessContract {
	private readonly project_root: string;
	private readonly definitions: QualityCheckDefinitionsContract;
	private readonly check_items: readonly QualityCheckContract[];
	private readonly command_runner: CommandRunnerContract;
	private readonly exit_process: ProcessExitContract;

	/** Responsibilities: _terminate process quality command_. **/
	private assert_success(status: number): boolean {
		if (status !== 0) {
			let exit_status = status;
			if (exit_status === null) {
				exit_status = 1;
			}
			this.exit_process.exit(exit_status);
			return false;
		}
		return true;
	}

	/** Responsibilities: _execution configuration quality command_. **/
	private command_arguments(check: QualityCheck, options: QualityCheckRunOptions): readonly string[] {
		let args = check.args;
		if (options.review_agent !== "none") {
			const review_arguments: readonly QualityCheckArgument[] = [
				{ enabled: options.force_review, argument: FORCE_REVIEW_ARGUMENT },
				{ enabled: options.review_cleanup, argument: REVIEW_CLEANUP_ARGUMENT },
			];
			for (const option of review_arguments) {
				if (option.enabled && check.supports_review_options === true) {
					args = [...args, "--", option.argument];
				}
			}
			if (check.supports_review_agent === true) {
				args = [...args, "--", REVIEW_AGENT_OPTION, options.review_agent];
			}
		}
		return args;
	}

	/** Responsibilities: _execution configuration quality command_. **/
	private run_command(check: QualityCheck, options: QualityCheckRunOptions): boolean {
		process.stdout.write(`🔎 Checking ${check.label}...\n`);
		const args = this.command_arguments(check, options);
		const result = this.command_runner.run(check.command, args, check.environment, this.project_root);
		return this.assert_command(check.command, result);
	}

	/** Responsibilities: _validation result quality command_. **/
	private assert_command(command: string, result: CommandResult): boolean {
		if (result.error_message.length === 0) {
			return this.assert_success(result.status);
		}
		process.stderr.write(`Failed to start ${command}: ${result.error_message}\n`);
		this.exit_process.exit(1);
		return false;
	}

	/** Responsibilities: _initialization project root quality_. **/
	constructor(project_root: string, command_runner: CommandRunnerContract, exit_process: ProcessExitContract) {
		this.project_root = project_root;
		this.definitions = new QualityCheckDefinitions(project_root);
		this.check_items = this.definitions.all_checks();
		this.command_runner = command_runner;
		this.exit_process = exit_process;
	}

	/** Responsibilities: _execution available quality checks_. **/
	public run(options: QualityCheckRunOptions): void {
		for (const check of this.check_items) {
			if (!this.run_command(check, options)) {
				return;
			}
		}
	}

	/** Responsibilities: _reporting least quality check_. **/
	public available_checks(): boolean {
		return this.check_items.length > 0;
	}
}
