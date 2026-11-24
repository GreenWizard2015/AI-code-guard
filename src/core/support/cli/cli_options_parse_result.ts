import type { CliOptions, CliOptionsParseResultContract, CliValidationContract } from "src/task_types";

/** Responsibilities: _CLI option state_, _validation message_. **/
export class CliOptionsParseResult implements CliOptionsParseResultContract, CliValidationContract {
	private readonly _is_valid: boolean;
	private readonly _message: string;
	private readonly _options: CliOptions;

	/** Responsibilities: _parsed option state_. **/
	public constructor(is_valid: boolean, message: string, options: CliOptions) {
		this._is_valid = is_valid;
		this._message = message;
		this._options = options;
	}

	/** Responsibilities: _option validity_. **/
	public valid(): boolean {
		return this._is_valid;
	}

	/** Responsibilities: _validation message_. **/
	public error_message(): string {
		return this._message;
	}

	/** Responsibilities: _parsed options_. **/
	public options(): CliOptions {
		if (!this._is_valid) {
			throw new Error(this._message);
		}
		return this._options;
	}
}
