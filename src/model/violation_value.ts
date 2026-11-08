import type { ReportViolationOptions, ViolationContract } from "src/reporting_protocols";

/** Responsibilities: _diagnostic value construction_, _diagnostic field access_, _line invariant validation_. **/
export class ViolationValue implements ViolationContract {
	private readonly _options: ReportViolationOptions;

	/** Responsibilities: _diagnostic violation initialization_. **/
	public constructor(options: ReportViolationOptions) {
		if (!Number.isInteger(options.line) || options.line < 0) {
			throw new Error(`Invalid diagnostic line ${options.line}.`);
		}
		this._options = Object.freeze({ ...options });
	}

	/** Responsibilities: _source file access_. **/
	public file(): string {
		return this._options.file;
	}
	/** Responsibilities: _diagnostic line access_. **/
	public line(): number {
		return this._options.line;
	}
	/** Responsibilities: _diagnostic message access_. **/
	public message(): string {
		return this._options.message;
	}
	/** Responsibilities: _diagnostic hint access_. **/
	public hint(): string {
		return this._options.hint;
	}
	/** Responsibilities: _rule identifier access_. **/
	public rule_id(): string {
		return this._options.rule_id;
	}
	/** Responsibilities: _diagnostic priority access_. **/
	public priority(): number {
		return this._options.priority;
	}
}
