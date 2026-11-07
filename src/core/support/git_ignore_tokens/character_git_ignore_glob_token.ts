import type { GitIgnoreGlobTokenContract } from "src/runtime_protocols";

/** Responsibilities: _Gitignore character matching_, _matcher row advancement_. **/
export class CharacterGitIgnoreGlobToken implements GitIgnoreGlobTokenContract {
	private readonly _expression: RegExp;

	/** Responsibilities: _character matcher initialization_. **/
	public constructor(expression: RegExp) {
		this._expression = expression;
	}

	/** Responsibilities: _minimum character token length_. **/
	public minimum_candidate_length(): number {
		return 1;
	}

	/** Responsibilities: _fixed character token width_. **/
	public variable_candidate_length(): boolean {
		return false;
	}

	/** Responsibilities: _literal row transition_. **/
	public advance_row(candidate: string, current_row: Uint8Array, next_row: Uint8Array): void {
		for (let index = candidate.length; index >= 0; index -= 1) {
			let matched = false;
			if (current_row.length === next_row.length && index < candidate.length) {
				const character = candidate[index];
				if (character !== undefined && this._expression.test(character)) {
					const next_index = index + 1;
					matched = next_index < next_row.length && next_row[next_index] === 1;
				}
			}
			current_row[index] = matched ? 1 : 0;
		}
	}

	/** Responsibilities: _character match transition_. **/
	public advance(candidate: string, index: number, current_row: Uint8Array, next_row: Uint8Array): boolean {
		if (current_row.length !== next_row.length || index < 0 || index >= candidate.length) {
			return false;
		}
		const character = candidate[index];
		if (character === undefined || !this._expression.test(character)) {
			return false;
		}
		const next_index = index + 1;
		if (next_index >= next_row.length) {
			return false;
		}
		return next_row[next_index] === 1;
	}
}
