import type { PythonFStringExpressionState } from "src/model/types/types";

/** Responsibilities: _f-string expression state_, _quoted expression tracking_, _nested group tracking_. **/
export class PythonFStringExpressionScanner {
	private readonly expression_state: PythonFStringExpressionState;

	/** Responsibilities: _quoted expression characters_. **/
	private advance_string(line: string, index: number): number {
		const character = line.charAt(index);
		if (this.expression_state.escaped) {
			this.expression_state.escaped = false;
			return index + 1;
		}
		switch (character) {
			case "\\":
				this.expression_state.escaped = true;
				break;
			case this.expression_state.quote:
				this.expression_state.quote = "";
				break;
		}
		return index + 1;
	}

	/** Responsibilities: _expression delimiter transitions_. **/
	private advance_group(character: string): void {
		switch (character) {
			case "'":
			case '"':
				this.expression_state.quote = character;
				break;
			case "{":
				this.expression_state.depth += 1;
				break;
			case "}":
				this.expression_state.depth -= 1;
				break;
		}
	}

	/** Responsibilities: _f-string expression state initialization_. **/
	public constructor() {
		this.expression_state = { depth: 0, quote: "", escaped: false };
	}

	/** Responsibilities: _expression character advancement_. **/
	public advance(line: string, index: number): number {
		if (this.expression_state.quote.length > 0) {
			return this.advance_string(line, index);
		}
		this.advance_group(line.charAt(index));
		return index + 1;
	}

	/** Responsibilities: _expression entry_. **/
	public begin(): void {
		this.expression_state.depth = 1;
	}

	/** Responsibilities: _active expression state_. **/
	public active(): boolean {
		return this.expression_state.depth > 0;
	}

	/** Responsibilities: _f-string expression reset_. **/
	public reset(): void {
		this.expression_state.depth = 0;
		this.expression_state.quote = "";
		this.expression_state.escaped = false;
	}
}
