import type { GitIgnoreGlobTokenContract } from "src/protocols";

/** Responsibilities: _segment wildcard transitions_, _path separator matching_. **/
export class SingleStarGitIgnoreGlobToken implements GitIgnoreGlobTokenContract {
	private readonly path_separator: string;

	/** Responsibilities: _single-star token initialization_. **/
	public constructor() {
		this.path_separator = "/";
	}

	/** Responsibilities: _single-star token transition_. **/
	public advance(
		candidate: string,
		index: number,
		current_row: readonly boolean[],
		next_row: readonly boolean[],
	): boolean {
		const can_finish_here = next_row[index] === true;
		const character = candidate[index];
		if (character === undefined || character === this.path_separator) {
			return can_finish_here;
		}
		return can_finish_here || current_row[index + 1] === true;
	}
}
