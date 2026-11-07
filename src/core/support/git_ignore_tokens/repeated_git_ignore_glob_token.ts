import type { GitIgnoreGlobTokenContract } from "src/runtime_protocols";

/** Responsibilities: _repeated wildcard transitions_, _line-break matching policy_. **/
export class RepeatedGitIgnoreGlobToken implements GitIgnoreGlobTokenContract {
	private readonly _linebreak_sensitive: boolean;
	private readonly _token_text: string;

	/** Responsibilities: _repeated wildcard initialization_. **/
	public constructor(token_text: string) {
		this._token_text = token_text;
		this._linebreak_sensitive = token_text === "**";
	}

	/** Responsibilities: _minimum repeated token length_. **/
	public minimum_candidate_length(): number {
		return 0;
	}

	/** Responsibilities: _variable repeated token width_. **/
	public variable_candidate_length(): boolean {
		return this._token_text.length > 0;
	}

	/** Responsibilities: _repeated wildcard row advancement_. **/
	public advance_row(candidate: string, current_row: Uint8Array, next_row: Uint8Array): void {
		for (let index = candidate.length; index >= 0; index -= 1) {
			const character = candidate[index];
			const common_line_break = character === "\n" || character === "\r";
			const unicode_line_break = character === "\u2028" || character === "\u2029";
			const line_separator = common_line_break || unicode_line_break;
			let matched = next_row[index] === 1;
			if (matched === false && character !== undefined && character !== "/") {
				if (this._linebreak_sensitive && line_separator) {
					current_row[index] = 0;
					continue;
				}
				matched = current_row[index + 1] === 1;
			}
			current_row[index] = matched ? 1 : 0;
		}
	}

	/** Responsibilities: _repeated wildcard transition_. **/
	public advance(candidate: string, index: number, current_row: Uint8Array, next_row: Uint8Array): boolean {
		if (next_row[index] === 1) {
			return true;
		}
		const character = candidate[index];
		const common_line_break = character === "\n" || character === "\r";
		const unicode_line_break = character === "\u2028" || character === "\u2029";
		const line_separator = common_line_break || unicode_line_break;
		if (character === undefined || character === "/") {
			return false;
		}
		if (this._linebreak_sensitive && line_separator) {
			return false;
		}
		return current_row[index + 1] === 1;
	}
}
