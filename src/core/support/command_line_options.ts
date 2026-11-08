import { POLICY_TOP_CATEGORY } from "src/constants";
import { CliOptionApplication } from "src/core/support/cli_option_application";
import type { CommandLineOptionsContract } from "src/task_protocols";
import type { CliOptions } from "src/task_types";

/** Responsibilities: _CLI argument parsing_, _task policy option application_. **/
export class CommandLineOptions implements CommandLineOptionsContract {
	private readonly _arguments_list: readonly string[];

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

	/** Responsibilities: _CLI argument ownership_. **/
	public constructor(arguments_list: readonly string[]) {
		this._arguments_list = arguments_list;
	}

	/** Responsibilities: _parsed CLI option snapshot_. **/
	public value(): CliOptions {
		const options = this.default_options();
		for (let index = 0; index < this._arguments_list.length; index += 1) {
			index = this.apply_argument(options, index);
		}
		return options;
	}
}
