import type { GitIgnoreGlobTokenContract } from "src/runtime_protocols";

/** Responsibilities: _recursive directory prefix transitions_, _directory-prefix token state_. **/
export class DirectoryPrefixGitIgnoreGlobToken implements GitIgnoreGlobTokenContract {
	private readonly _token_text: string;

	/** Responsibilities: _directory prefix initialization_. **/
	public constructor(token_text: string) {
		this._token_text = token_text;
	}

	/** Responsibilities: _minimum directory prefix length_. **/
	public minimum_candidate_length(): number {
		return 0;
	}

	/** Responsibilities: _variable directory prefix width_. **/
	public variable_candidate_length(): boolean {
		return this._token_text.length > 0;
	}

	/** Responsibilities: _directory prefix row advancement_. **/
	public advance_row(candidate: string, current_row: Uint8Array, next_row: Uint8Array): void {
		for (let index = candidate.length; index >= 0; index -= 1) {
			const character = candidate[index];
			const common_line_break = character === "\n" || character === "\r";
			const unicode_line_break = character === "\u2028" || character === "\u2029";
			const line_separator = common_line_break || unicode_line_break;
			let matched = next_row[index] === 1;
			if (matched === false && character === "/") {
				matched = next_row[index + 1] === 1;
			}
			if (matched === false && character !== undefined && line_separator === false) {
				matched = current_row[index + 1] === 1;
			}
			current_row[index] = matched ? 1 : 0;
		}
	}

	/** Responsibilities: _directory prefix transition_. **/
	public advance(candidate: string, index: number, current_row: Uint8Array, next_row: Uint8Array): boolean {
		if (next_row[index] === 1) {
			return true;
		}
		const character = candidate[index];
		const common_line_break = character === "\n" || character === "\r";
		const unicode_line_break = character === "\u2028" || character === "\u2029";
		const line_separator = common_line_break || unicode_line_break;
		if (character === "/" && next_row[index + 1] === 1) {
			return true;
		}
		if (character === undefined || line_separator) {
			return false;
		}
		return current_row[index + 1] === 1;
	}
}
