import type { GitIgnoreGlobTokenContract } from "src/runtime_protocols";

/** Responsibilities: _one-character wildcard transition_, _fixed-width wildcard token_. **/
export class QuestionMarkGitIgnoreGlobToken implements GitIgnoreGlobTokenContract {
	private readonly _token_text: string;

	/** Responsibilities: _question token initialization_. **/
	public constructor(token_text: string) {
		this._token_text = token_text;
		if (this._token_text !== "?") {
			throw new Error("Question mark glob token must represent '?'.");
		}
	}

	/** Responsibilities: _minimum character token length_. **/
	public minimum_candidate_length(): number {
		return this._token_text.length;
	}

	/** Responsibilities: _fixed character token width_. **/
	public variable_candidate_length(): boolean {
		return false;
	}

	/** Responsibilities: _single-character row advancement_. **/
	public advance_row(candidate: string, current_row: Uint8Array, next_row: Uint8Array): void {
		const equal_rows = current_row.length === next_row.length;
		for (let index = candidate.length; index >= 0; index -= 1) {
			const character = candidate[index];
			let matched = false;
			if (equal_rows && character !== undefined && character !== "/") {
				matched = next_row[index + 1] === 1;
			}
			current_row[index] = matched ? 1 : 0;
		}
	}

	/** Responsibilities: _single-character transition_. **/
	public advance(candidate: string, index: number, current_row: Uint8Array, next_row: Uint8Array): boolean {
		if (current_row.length !== next_row.length) {
			return false;
		}
		const character = candidate[index];
		if (character === undefined || character === "/") {
			return false;
		}
		return next_row[index + 1] === 1;
	}
}
