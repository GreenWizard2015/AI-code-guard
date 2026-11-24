import type { PythonFStringCharacterTransition, PythonFStringExpressionState } from "src/model_types";
import type { PythonFStringExpressionScannerContract } from "src/rules/support/protocols";

/** Responsibilities: _f-string expression scanning_, _quote state management_. **/
export class PythonFStringExpressionScanner implements PythonFStringExpressionScannerContract {
	private readonly _state: PythonFStringExpressionState;
	private readonly _quoted_character_transitions: ReadonlyMap<string, PythonFStringCharacterTransition>;

	/** Responsibilities: _quoted expression scanning_. **/
	private advance_quoted(line: string, index: number): number {
		const character = line.charAt(index);
		if (this._state.escaped) {
			this._state.escaped = false;
		} else {
			const transition = this._quoted_character_transitions.get(`${character}${this._state.quote}`);
			if (transition !== undefined) {
				this._state.escaped = transition.escaped;
				this._state.quote = transition.quote;
			}
		}
		return index + 1;
	}

	/** Responsibilities: _expression delimiter advancement_. **/
	private advance_delimiter(character: string): void {
		switch (character) {
			case "'":
			case '"':
				this._state.quote = character;
				break;
			case "{":
				this._state.depth += 1;
				break;
			case "}":
				this._state.depth -= 1;
				break;
			default:
				break;
		}
	}

	/** Responsibilities: _quote state initialization_. **/
	public constructor() {
		this._state = { depth: 0, quote: "", escaped: false };
		this._quoted_character_transitions = new Map([
			["\\'", { escaped: true, quote: "'" }],
			['\\"', { escaped: true, quote: '"' }],
			["''", { escaped: false, quote: "" }],
			['""', { escaped: false, quote: "" }],
		]);
	}

	/** Responsibilities: _expression state reset_. **/
	public reset(): void {
		this._state.depth = 0;
		this._state.quote = "";
		this._state.escaped = false;
	}

	/** Responsibilities: _expression state entry_. **/
	public begin(): void {
		this._state.depth = 1;
	}

	/** Responsibilities: _expression boundary detection_. **/
	public active(): boolean {
		return this._state.depth > 0;
	}

	/** Responsibilities: _expression character scanning_. **/
	public advance(line: string, index: number): number {
		if (this._state.quote.length > 0) {
			return this.advance_quoted(line, index);
		}
		this.advance_delimiter(line.charAt(index));
		return index + 1;
	}
}
