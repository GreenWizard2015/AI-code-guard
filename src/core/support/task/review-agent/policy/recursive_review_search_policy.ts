import { REVIEW_HIDDEN_SEARCH_OPTION, REVIEW_SEARCH_VALUE_OPTIONS } from "src/core/support/task/review-agent/constants";
import type { ReviewPathPolicyContract } from "src/core/support/task/review-agent/protocols";

/** Responsibilities: _recursive search scope_, _review path boundary_. **/
export class RecursiveReviewSearchPolicy {
	private readonly _path_policy: ReviewPathPolicyContract;

	/** Responsibilities: _recursive text-search classification_. **/
	private recursive_text_search(command_name: string, command_arguments: readonly string[]): boolean {
		if (command_name === "rg") {
			return command_arguments.includes(REVIEW_HIDDEN_SEARCH_OPTION);
		}
		if (command_name === "grep") {
			return command_arguments.includes("-r") || command_arguments.includes("-R");
		}
		return false;
	}

	/** Responsibilities: _search target count_. **/
	private positional_count(command_arguments: readonly string[]): number {
		let count = 0;
		for (let index = 1; index < command_arguments.length; index += 1) {
			const word = command_arguments[index];
			if (word === undefined) {
				continue;
			}
			if (REVIEW_SEARCH_VALUE_OPTIONS.includes(word)) {
				index += 1;
				continue;
			}
			if (!word.startsWith("-")) {
				count += 1;
			}
		}
		return count;
	}

	/** Responsibilities: _policy initialization_. **/
	public constructor(path_policy: ReviewPathPolicyContract) {
		this._path_policy = path_policy;
	}

	/** Responsibilities: _implicit search scope classification_. **/
	public blocks(command: string, words: readonly string[], command_cwd: string): boolean {
		if (command === "find" && words.length === 1) {
			return !this._path_policy.allows_recursive_path(".", command_cwd);
		}
		if (command === "ls" && words.includes("-R") && words.length === 2) {
			return !this._path_policy.allows_recursive_path(".", command_cwd);
		}
		if (!this.recursive_text_search(command, words)) {
			return false;
		}
		if (this.positional_count(words) > 1) {
			return false;
		}
		return !this._path_policy.allows_recursive_path(".", command_cwd);
	}

	/** Responsibilities: _recursive command classification_. **/
	public recursive(command: string, words: readonly string[]): boolean {
		if (command === "find") {
			return true;
		}
		if (this.recursive_text_search(command, words)) {
			return true;
		}
		return command === "ls" && words.includes("-R");
	}
}
