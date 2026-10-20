import type { GitIgnoreGlobTokenContract } from "src/runtime_protocols";

/** Responsibilities: _Gitignore character-class matching_, _parser token boundary_. **/
export class CharacterClassGitIgnoreGlobToken implements GitIgnoreGlobTokenContract {
	private readonly expression: RegExp;
	public readonly end_index: number;

	/** Responsibilities: _character-class token initialization_. **/
	public constructor(expression: RegExp, end_index: number) {
		this.expression = expression;
		this.end_index = end_index;
	}

	/** Responsibilities: _character-class token transition_. **/
	public advance(
		candidate: string,
		index: number,
		current_row: Uint8Array,
		next_row: Uint8Array,
	): boolean {
		if (current_row.length !== next_row.length) {
			return false;
		}
		const character = candidate[index];
		if (character === undefined || !this.expression.test(character)) {
			return false;
		}
		return next_row[index + 1] === 1;
	}
}
