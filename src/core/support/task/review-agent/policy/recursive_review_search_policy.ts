import { resolve } from "node:path";
import { REVIEW_HIDDEN_SEARCH_OPTION, REVIEW_SEARCH_VALUE_OPTIONS } from "src/core/support/task/review-agent/constants";
import type { ResolvedReviewPathPolicyContract } from "src/core/support/task/review-agent/protocols";

/** Responsibilities: _recursive search scope_, _review path boundary_. **/
export class RecursiveReviewSearchPolicy {
	private readonly resolved_review_paths: ResolvedReviewPathPolicyContract;

	/** Responsibilities: _recursive text search classification_. **/
	private recursive_text_search(command: string, words: readonly string[]): boolean {
		if (command === "rg") {
			return words.includes(REVIEW_HIDDEN_SEARCH_OPTION);
		}
		if (command !== "grep") {
			return false;
		}
		return words.includes("-r") || words.includes("-R");
	}

	/** Responsibilities: _search target count_. **/
	private positional_count(words: readonly string[]): number {
		let count = 0;
		for (let index = 1; index < words.length; index += 1) {
			const word = words[index];
			if (word === undefined) {
				continue;
			}
			if (REVIEW_SEARCH_VALUE_OPTIONS.includes(word)) {
				index += 1;
				continue;
			}
			if (word.startsWith("-")) {
				continue;
			}
			count += 1;
		}
		return count;
	}

	/** Responsibilities: _implicit text-search scope_. **/
	private blocks_text_search(
		command: string,
		words: readonly string[],
		command_cwd: string,
		root_cwd: string,
	): boolean {
		if (!this.recursive_text_search(command, words)) {
			return false;
		}
		if (this.positional_count(words) > 1) {
			return false;
		}
		return this.resolved_review_paths.blocks(resolve(command_cwd), root_cwd, true);
	}

	/** Responsibilities: _policy initialization_. **/
	public constructor(resolved_review_paths: ResolvedReviewPathPolicyContract) {
		this.resolved_review_paths = resolved_review_paths;
	}

	/** Responsibilities: _implicit search scope classification_. **/
	public blocks(command: string, words: readonly string[], command_cwd: string, root_cwd: string): boolean {
		if (command === "find" && words.length === 1) {
			return this.resolved_review_paths.blocks(resolve(command_cwd), root_cwd, true);
		}
		if (command === "ls" && words.includes("-R") && words.length === 2) {
			return this.resolved_review_paths.blocks(resolve(command_cwd), root_cwd, true);
		}
		return this.blocks_text_search(command, words, command_cwd, root_cwd);
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
