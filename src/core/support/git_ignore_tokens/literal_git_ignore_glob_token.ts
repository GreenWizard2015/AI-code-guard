import type { GitIgnoreGlobTokenContract } from "src/protocols";

/** Responsibilities: _literal value storage_, _Gitignore character transition_. **/
export class LiteralGitIgnoreGlobToken implements GitIgnoreGlobTokenContract {
	private readonly value: string;

	/** Responsibilities: _literal token initialization_. **/
	public constructor(value: string) {
		this.value = value;
	}

	/** Responsibilities: _literal token transition_. **/
	public advance(
		candidate: string,
		index: number,
		current_row: readonly boolean[],
		next_row: readonly boolean[],
	): boolean {
		if (current_row.length !== next_row.length) {
			return false;
		}
		const character = candidate[index];
		if (character === undefined || character !== this.value) {
			return false;
		}
		return next_row[index + 1] === true;
	}
}
