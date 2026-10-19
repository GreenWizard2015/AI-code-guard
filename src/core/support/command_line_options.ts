import { resolve } from "node:path";
import { REMOVED_SKIP_REVIEW_MESSAGE } from "src/constants";
import type { CliOptions } from "src/types";
import { POLICY_ALL, POLICY_TOP_CATEGORY } from "src/constants";
import { REVIEW_STAGES } from "src/constants";

/** Responsibilities: _CLI argument parsing_, _task policy option application_. **/
export class CommandLineOptions {
	private readonly option_prefix = "--";

	/** Responsibilities: _creation default CLI option_. **/
	private default_options(): CliOptions {
		return {
			ignored_directories: [],
			entry_files: [],
			root: process.cwd(),
			skip_review: true,
			force_review: false,
			review_cleanup: false,
			review_agent: "none",
			review_stages: [],
			batch_size: 10,
			policy: POLICY_TOP_CATEGORY,
		};
	}

	/** Responsibilities: _application directory-related CLI option_. **/
	private apply_directory_option(options: CliOptions, option: string, value: string): boolean {
		if (option === `${this.option_prefix}ignore-dir`) {
			options.ignored_directories.push(value);
			return true;
		}
		if (option === `${this.option_prefix}entry-file`) {
			options.entry_files.push(value.replaceAll("\\", "/"));
			return true;
		}
		if (option === `${this.option_prefix}root`) {
			options.root = resolve(process.cwd(), value);
			return true;
		}
		return false;
	}

	/** Responsibilities: _application task report-related CLI_. **/
	private apply_batch_size(options: CliOptions, option: string, value: string): boolean {
		if (option === `${this.option_prefix}batch-size`) {
			const batch_size = Number(value);
			if (!Number.isInteger(batch_size)) {
				throw new Error(`Invalid --batch-size value: ${value}`);
			}
			if (batch_size < 1) {
				throw new Error(`Invalid --batch-size value: ${value}`);
			}
			options.batch_size = batch_size;
			return true;
		}
		return false;
	}

	/** Responsibilities: _application task policy CLI_. **/
	private apply_policy(options: CliOptions, option: string, value: string): boolean {
		if (option === `${this.option_prefix}policy`) {
			if (value !== POLICY_TOP_CATEGORY && value !== POLICY_ALL) {
				throw new Error(`Invalid --policy value: ${value}`);
			}
			options.policy = value;
			return true;
		}
		return false;
	}

	/** Responsibilities: _application review-agent CLI option_. **/
	private apply_review_agent(options: CliOptions, option: string, value: string): boolean {
		if (option !== `${this.option_prefix}review-agent`) {
			return false;
		}
		if (value !== "codex" && value !== "claude") {
			throw new Error(`Invalid --review-agent value: ${value}`);
		}
		options.review_agent = value;
		options.skip_review = false;
		return true;
	}

	/** Responsibilities: _review-stage selection_. **/
	private apply_review_stage(options: CliOptions, option: string, value: string): boolean {
		if (option !== `${this.option_prefix}review-stage`) {
			return false;
		}
		if (!REVIEW_STAGES.some((stage) => stage.id === value)) {
			throw new Error(`Invalid --review-stage value: ${value}`);
		}
		if (!options.review_stages.includes(value)) {
			options.review_stages.push(value);
		}
		return true;
	}

	/** Responsibilities: _application task option dispatch_. **/
	private apply_task_option(options: CliOptions, option: string, value: string): boolean {
		if (this.apply_batch_size(options, option, value)) {
			return true;
		}
		if (this.apply_review_agent(options, option, value)) {
			return true;
		}
		if (this.apply_review_stage(options, option, value)) {
			return true;
		}
		return this.apply_policy(options, option, value);
	}

	/** Responsibilities: _application boolean CLI option_. **/
	private apply_boolean_option(options: CliOptions, option: string): boolean {
		if (option === `${this.option_prefix}force-review`) {
			options.force_review = true;
			return true;
		}
		if (option === `${this.option_prefix}review-cleanup`) {
			options.review_cleanup = true;
			return true;
		}
		return false;
	}

	/** Responsibilities: _one CLI argument application_. **/
	private apply_argument(options: CliOptions, arguments_list: readonly string[], index: number): number {
		const option = arguments_list[index];
		if (option === `${this.option_prefix}skip-review`) {
			throw new Error(REMOVED_SKIP_REVIEW_MESSAGE);
		}
		if (this.apply_boolean_option(options, option)) {
			return index;
		}
		const value = arguments_list[index + 1];
		if (value === undefined || !this.option_applied(options, option, value)) {
			return index;
		}
		return index + 1;
	}

	/** Responsibilities: _application CLI option reporting_. **/
	public option_applied(options: CliOptions, option: string, value: string): boolean {
		if (this.apply_directory_option(options, option, value)) {
			return true;
		}
		return this.apply_task_option(options, option, value);
	}

	/** Responsibilities: _raw CLI argument parsing_. **/
	public from_arguments(arguments_list: readonly string[]): CliOptions {
		const options = this.default_options();
		for (let index = 0; index < arguments_list.length; index += 1) {
			index = this.apply_argument(options, arguments_list, index);
		}
		return options;
	}
}
