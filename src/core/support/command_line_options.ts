import { IGNORE_DIRECTORY_OPTION, POLICY_TOP_CATEGORY, REVIEW_AGENT_OPTION } from "src/constants";
import { INVALID_AGENT_BATCH_SIZE_MESSAGE, MINIMUM_AGENT_BATCH_SIZE } from "src/core/constants";
import { CliOptionApplication } from "src/core/support/cli_option_application";
import { CliOptionsParseResult } from "src/core/support/cli_options_parse_result";
import type { CommandLineOptionsContract } from "src/task_protocols";
import type { CliOptions, CliOptionsParseResultContract } from "src/task_types";

/** Responsibilities: _CLI argument parsing_, _task policy option application_. **/
export class CommandLineOptions implements CommandLineOptionsContract {
	private readonly _arguments_list: readonly string[];
	private readonly _agent_option = "--agents";
	private readonly _batch_size_option = "--batch-size";
	private readonly _value_options: ReadonlySet<string>;

	/** Responsibilities: _default CLI option values_. **/
	private default_options(): CliOptions {
		return {
			ignored_directories: [],
			entry_files: [],
			root: process.cwd(),
			skip_review: true,
			force_review: false,
			review_agent: "none",
			review_stages: [],
			batch_size: 10,
			agent_mode: { package_count: 0, test_target_links: [] },
			policy: POLICY_TOP_CATEGORY,
		};
	}

	/** Responsibilities: _CLI argument dispatch_. **/
	private apply_argument(options: CliOptions, index: number): number {
		const option = this._arguments_list[index];
		if (option === undefined) {
			return index;
		}
		const candidate_value = this._arguments_list[index + 1];
		let next_value = "";
		let has_next_value = false;
		if (candidate_value !== undefined) {
			next_value = candidate_value;
			has_next_value = true;
		}
		const application = new CliOptionApplication({ options, option, next_value, has_next_value });
		if (application.apply()) {
			return index + 1;
		}
		return index;
	}

	/** Responsibilities: _agent count option validation_. **/
	private validate_agent_argument(index: number): string {
		const value = this._arguments_list[index + 1] ?? "";
		const agents = Number(value);
		if (!Number.isInteger(agents) || agents < 1) {
			return `Invalid ${this._agent_option} value: ${value}`;
		}
		return "";
	}

	/** Responsibilities: _agent option scan_. **/
	private validate_agents(): string {
		for (let index = 0; index < this._arguments_list.length; index += 1) {
			const option = this._arguments_list[index] ?? "";
			if (option === this._agent_option) {
				const error_message = this.validate_agent_argument(index);
				if (error_message.length > 0) {
					return error_message;
				}
			}
			if (this._value_options.has(option) && this._arguments_list[index + 1] !== undefined) {
				index += 1;
			}
		}
		return "";
	}

	/** Responsibilities: _CLI argument ownership_. **/
	public constructor(arguments_list: readonly string[]) {
		this._arguments_list = arguments_list;
		this._value_options = new Set([
			this._agent_option,
			this._batch_size_option,
			"--entry-file",
			IGNORE_DIRECTORY_OPTION,
			"--policy",
			REVIEW_AGENT_OPTION,
			"--review-stage",
			"--root",
		]);
	}

	/** Responsibilities: _CLI option validation_. **/
	public validated_options(): CliOptionsParseResultContract {
		const options = this.default_options();
		const agent_error = this.validate_agents();
		if (agent_error.length > 0) {
			return new CliOptionsParseResult(false, agent_error, options);
		}
		for (let index = 0; index < this._arguments_list.length; index += 1) {
			index = this.apply_argument(options, index);
		}
		if (options.agent_mode.package_count > 0 && options.batch_size < MINIMUM_AGENT_BATCH_SIZE) {
			return new CliOptionsParseResult(false, INVALID_AGENT_BATCH_SIZE_MESSAGE, options);
		}
		return new CliOptionsParseResult(true, "", options);
	}

	/** Responsibilities: _CLI option value access_. **/
	public value(): CliOptions {
		const result = this.validated_options();
		if (!result.valid()) {
			throw new Error(result.error_message());
		}
		return result.options();
	}
}
