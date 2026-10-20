import type { GitIgnoreGlobTokenContract } from "src/runtime_protocols";

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
		current_row: Uint8Array,
		next_row: Uint8Array,
	): boolean {
		const can_finish_here = next_row[index] === 1;
		const character = candidate[index];
		if (character === undefined || character === this.path_separator) {
			return can_finish_here;
		}
		return can_finish_here || current_row[index + 1] === 1;
	}
}
