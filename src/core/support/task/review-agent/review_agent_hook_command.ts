import {
	REVIEW_PHASE_ARGUMENT,
	REVIEW_PREFIX_ARGUMENT,
	REVIEW_STARTED_AT_ARGUMENT,
} from "src/core/support/task/review-agent/constants";

/** Responsibilities: _hook command argument encoding_, _provider command serialization_. **/
export class ReviewAgentHookCommand {
	private readonly _hook_command: string;
	private readonly _hook_file: string;
	private readonly _review_prefix: string;
	private readonly _review_phase: string;
	private readonly _review_start_ms: number;

	/** Responsibilities: _hook configuration validation_. **/
	private missing_hook_inputs(): boolean {
		if (this._hook_command.trim().length === 0) {
			return true;
		}
		if (this._hook_file.trim().length === 0) {
			return true;
		}
		return this._review_prefix.trim().length === 0;
	}

	/** Responsibilities: _hook command initialization_. **/
	public constructor(
		hook_command: string,
		hook_file: string,
		review_prefix: string,
		review_phase: string,
		review_start_ms: number,
	) {
		this._hook_command = hook_command;
		this._hook_file = hook_file;
		this._review_prefix = review_prefix;
		this._review_phase = review_phase;
		this._review_start_ms = review_start_ms;
		if (this.missing_hook_inputs()) {
			throw new Error("Review hook command, file, and prefix are required.");
		}
	}

	/** Responsibilities: _hook command arguments_. **/
	public arguments(): readonly string[] {
		return [
			this._hook_command,
			this._hook_file,
			REVIEW_PREFIX_ARGUMENT,
			this._review_prefix,
			REVIEW_PHASE_ARGUMENT,
			this._review_phase,
			REVIEW_STARTED_AT_ARGUMENT,
			String(this._review_start_ms),
		];
	}

	/** Responsibilities: _provider hook command_. **/
	public command(): string {
		const quoted: string[] = [];
		for (const value of this.arguments()) {
			quoted.push(`'${value.replaceAll("'", "'\"'\"'")}'`);
		}
		return quoted.join(" ");
	}
}
