import { resolve } from "node:path";
import { POLICY_ALL, POLICY_TOP_CATEGORY, REMOVED_SKIP_REVIEW_MESSAGE, REVIEW_STAGES } from "src/constants";
import type { CliOptionApplicationContract, CliOptionApplicationInput } from "src/task_protocols";
import type { CliOptions } from "src/task_types";

/** Responsibilities: _CLI option dispatch_, _CLI state update_. **/
export class CliOptionApplication implements CliOptionApplicationContract {
	private readonly option_prefix = "--";
	private readonly _options: CliOptions;
	private readonly _option: string;
	private readonly _next_value: string;
	private readonly _has_next_value: boolean;

	/** Responsibilities: _directory CLI option application_. **/
	private apply_directory_option(): boolean {
		if (this._option === `${this.option_prefix}ignore-dir`) {
			this._options.ignored_directories.push(this._next_value);
			return true;
		}
		if (this._option === `${this.option_prefix}entry-file`) {
			this._options.entry_files.push(this._next_value.replaceAll("\\", "/"));
			return true;
		}
		if (this._option === `${this.option_prefix}root`) {
			this._options.root = resolve(process.cwd(), this._next_value);
			return true;
		}
		return false;
	}

	/** Responsibilities: _batch size validation_. **/
	private apply_batch_size(): boolean {
		if (this._option !== `${this.option_prefix}batch-size`) {
			return false;
		}
		const batch_size = Number(this._next_value);
		if (!Number.isInteger(batch_size) || batch_size < 1) {
			throw new Error(`Invalid --batch-size value: ${this._next_value}`);
		}
		this._options.batch_size = batch_size;
		return true;
	}

	/** Responsibilities: _policy CLI option application_. **/
	private apply_policy(): boolean {
		if (this._option !== `${this.option_prefix}policy`) {
			return false;
		}
		if (this._next_value !== POLICY_TOP_CATEGORY && this._next_value !== POLICY_ALL) {
			throw new Error(`Invalid --policy value: ${this._next_value}`);
		}
		this._options.policy = this._next_value;
		return true;
	}

	/** Responsibilities: _review agent option application_. **/
	private apply_review_agent(): boolean {
		if (this._option !== `${this.option_prefix}review-agent`) {
			return false;
		}
		if (this._next_value !== "codex" && this._next_value !== "claude") {
			throw new Error(`Invalid --review-agent value: ${this._next_value}`);
		}
		this._options.review_agent = this._next_value;
		this._options.skip_review = false;
		return true;
	}

	/** Responsibilities: _review stage option application_. **/
	private apply_review_stage(): boolean {
		if (this._option !== `${this.option_prefix}review-stage`) {
			return false;
		}
		if (!REVIEW_STAGES.some((stage) => stage.id === this._next_value)) {
			throw new Error(`Invalid --review-stage value: ${this._next_value}`);
		}
		if (!this._options.review_stages.includes(this._next_value)) {
			this._options.review_stages.push(this._next_value);
		}
		return true;
	}

	/** Responsibilities: _task CLI option application_. **/
	private apply_task_option(): boolean {
		if (this.apply_batch_size()) {
			return true;
		}
		if (this.apply_review_agent()) {
			return true;
		}
		if (this.apply_review_stage()) {
			return true;
		}
		return this.apply_policy();
	}

	/** Responsibilities: _boolean CLI option application_. **/
	private apply_boolean_option(): boolean {
		if (this._option === `${this.option_prefix}force-review`) {
			this._options.force_review = true;
			return true;
		}
		if (this._option === `${this.option_prefix}review-cleanup`) {
			this._options.review_cleanup = true;
			return true;
		}
		return false;
	}

	/** Responsibilities: _value CLI option application_. **/
	private apply_value_option(): boolean {
		if (this.apply_directory_option()) {
			return true;
		}
		return this.apply_task_option();
	}

	/** Responsibilities: _CLI option application initialization_. **/
	public constructor(input: CliOptionApplicationInput) {
		this._options = input.options;
		this._option = input.option;
		this._next_value = input.next_value;
		this._has_next_value = input.has_next_value;
	}

	/** Responsibilities: _CLI option application_. **/
	public apply(): boolean {
		if (this._option === `${this.option_prefix}skip-review`) {
			throw new Error(REMOVED_SKIP_REVIEW_MESSAGE);
		}
		if (this.apply_boolean_option()) {
			return false;
		}
		if (!this._has_next_value) {
			return false;
		}
		return this.apply_value_option();
	}
}
