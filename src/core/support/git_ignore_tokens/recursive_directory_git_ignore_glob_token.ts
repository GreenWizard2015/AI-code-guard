import type { GitIgnoreGlobTokenContract } from "src/runtime_protocols";

/** Responsibilities: _directory boundary transitions_, _line separator exclusion_. **/
export class RecursiveDirectoryGitIgnoreGlobToken implements GitIgnoreGlobTokenContract {
	private readonly directory_separator: string;
	private readonly line_separator: RegExp;

	/** Responsibilities: _recursive-directory token initialization_. **/
	public constructor() {
		this.directory_separator = "/";
		this.line_separator = /[\n\r\u2028\u2029]/u;
	}

	/** Responsibilities: _recursive-directory token transition_. **/
	public advance(
		candidate: string,
		index: number,
		current_row: Uint8Array,
		next_row: Uint8Array,
	): boolean {
		const can_finish_here = next_row[index] === 1;
		const character = candidate[index];
		let crosses_directory = false;
		if (character === this.directory_separator && next_row[index + 1] === 1) {
			crosses_directory = true;
		}
		let consumes_character = false;
		if (character !== undefined && !this.line_separator.test(character)) {
			consumes_character = current_row[index + 1] === 1;
		}
		return can_finish_here || crosses_directory || consumes_character;
	}
}
