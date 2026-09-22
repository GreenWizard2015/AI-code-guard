import type { ViolationOptions } from 'src/types';

/** Responsibilities: _diagnostic violation data storage_, _adjusted violation copies creation_. **/
export class Violation {
	public readonly file: string;
	public readonly line: number;
	public readonly message: string;
	public readonly hint: string;
	public readonly rule_id: string;
	public readonly priority: number;

	/** Responsibilities: _diagnostic violation initialization_. **/
	public constructor(options: ViolationOptions) {
		this.file = options.file;
		this.line = options.line;
		this.message = options.message;
		this.hint = options.hint;
		this.rule_id = options.rule_id;
		this.priority = options.priority;
	}

	/** Responsibilities: _violation different line copying_. **/
	public with_line(line: number): Violation {
		return new Violation({ ...this.details(), line });
	}

	/** Responsibilities: _output violation construction details_. **/
	public details(): ViolationOptions {
		return {
			file: this.file,
			line: this.line,
			message: this.message,
			hint: this.hint,
			rule_id: this.rule_id,
			priority: this.priority,
		};
	}
}
