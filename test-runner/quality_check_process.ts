import type { QualityCheckCatalogContract, QualityCheckRunnerContract } from "src/task_types";
import { FORCE_REVIEW_ARGUMENT, REVIEW_AGENT_OPTION, REVIEW_CLEANUP_ARGUMENT } from "test-runner/constants";
import { QualityCheckDefinitions } from "test-runner/quality_check_definitions";
import type {
	CommandResult,
	CommandRunnerContract,
	QualityCheck,
	QualityCheckArgument,
	QualityCheckRunOptions,
	TestRunnerOutput,
	TestRunnerRequest,
} from "test-runner/types";

/** Responsibilities: _quality command execution_, _quality failure reporting_. **/
export class QualityCheckProcess implements QualityCheckRunnerContract {
	private readonly _project_root: string;
	private readonly _definitions: QualityCheckCatalogContract;
	private readonly _check_items: readonly QualityCheck[];
	private readonly _command_runner: CommandRunnerContract;
	private readonly _output: TestRunnerOutput;

	/** Responsibilities: _execution configuration quality command_. **/
	private run_command(check: QualityCheck, options: QualityCheckRunOptions): number {
		this._output.stdout.write(`🔎 Checking ${check.label}...\n`);
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
		const result = this._command_runner.run(check.command, args, check.environment, this._project_root);
		return this.assert_command(check.command, result);
	}

	/** Responsibilities: _validation result quality command_. **/
	private assert_command(command: string, result: CommandResult): number {
		if (result.error_message.length === 0) {
			return result.status;
		}
		this._output.stderr.write(`Failed to start ${command}: ${result.error_message}\n`);
		return 1;
	}

	/** Responsibilities: _initialization project root quality_. **/
	public constructor(project_root: string, command_runner: CommandRunnerContract, output: TestRunnerOutput) {
		this._project_root = project_root;
		this._definitions = new QualityCheckDefinitions(project_root);
		this._check_items = this._definitions.all_checks();
		this._command_runner = command_runner;
		this._output = output;
	}

	/** Responsibilities: _execution available quality checks_. **/
	public run(options: QualityCheckRunOptions): number {
		for (const check of this._check_items) {
			const status = this.run_command(check, options);
			if (status !== 0) {
				return status;
			}
		}
		return 0;
	}

	/** Responsibilities: _test request quality checks_. **/
	public run_test_request(request: TestRunnerRequest): number {
		if (request.skip_quality) {
			return 0;
		}
		return this.run({
			force_review: request.force_review,
			review_cleanup: request.review_cleanup,
			review_agent: request.review_agent,
		});
	}
}
