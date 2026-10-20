import type { GitIgnoreGlobTokenContract } from "src/runtime_protocols";

/** Responsibilities: _recursive character transitions_, _line separator exclusion_. **/
export class RecursiveStarGitIgnoreGlobToken implements GitIgnoreGlobTokenContract {
	private readonly line_separator: RegExp;

	/** Responsibilities: _recursive-star token initialization_. **/
	public constructor() {
		this.line_separator = /[\n\r\u2028\u2029]/u;
	}

	/** Responsibilities: _recursive-star token transition_. **/
	public advance(
		candidate: string,
		index: number,
		current_row: Uint8Array,
		next_row: Uint8Array,
	): boolean {
		const can_finish_here = next_row[index] === 1;
		const character = candidate[index];
		if (character === undefined || this.line_separator.test(character)) {
			return can_finish_here;
		}
		return can_finish_here || current_row[index + 1] === 1;
	}
}
