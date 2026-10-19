import type { GitIgnoreGlobTokenContract } from "src/protocols";

/** Responsibilities: _single character matching_, _path separator exclusion_. **/
export class SingleCharacterGitIgnoreGlobToken implements GitIgnoreGlobTokenContract {
	private readonly path_separator: string;

	/** Responsibilities: _single-character token initialization_. **/
	public constructor() {
		this.path_separator = "/";
	}

	/** Responsibilities: _single-character token transition_. **/
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
		if (character === undefined || character === this.path_separator) {
			return false;
		}
		return next_row[index + 1] === true;
	}
}
