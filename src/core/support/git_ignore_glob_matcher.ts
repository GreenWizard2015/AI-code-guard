import type { GitIgnoreGlobMatcherContract, GitIgnoreGlobTokenContract } from "src/protocols";
import type { GitIgnoreGlobMatchResult } from "src/types";

/** Responsibilities: _bounded Gitignore glob matching_, _path segment matching_. **/
export class GitIgnoreGlobMatcher implements GitIgnoreGlobMatcherContract {
	private readonly tokens: readonly GitIgnoreGlobTokenContract[];
	private readonly candidate_match_cache: Map<string, boolean>;

	/** Responsibilities: _token suffix evaluation_. **/
	private token_row(token: GitIgnoreGlobTokenContract, candidate: string, next_row: boolean[]): boolean[] {
		const current_row = new Array<boolean>(candidate.length + 1);
		current_row.fill(false);
		for (let index = candidate.length; index >= 0; index -= 1) {
			current_row[index] = token.advance(candidate, index, current_row, next_row);
		}
		return current_row;
	}

	/** Responsibilities: _candidate state evaluation_. **/
	private calculate_candidate_match(candidate: string): GitIgnoreGlobMatchResult {
		const row_length = candidate.length + 1;
		let next_row = new Array<boolean>(row_length);
		next_row.fill(false);
		next_row[candidate.length] = true;
		let visited_states = next_row.length;
		for (let token_index = this.tokens.length - 1; token_index >= 0; token_index -= 1) {
			const token = this.tokens[token_index];
			if (token === undefined) {
				continue;
			}
			const current_row = this.token_row(token, candidate, next_row);
			visited_states += current_row.length;
			next_row = current_row;
		}
		return { matched: next_row[0] === true, visited_states };
	}

	/** Responsibilities: _Gitignore pattern matching_. **/
	public constructor(tokens: readonly GitIgnoreGlobTokenContract[]) {
		this.tokens = tokens;
		this.candidate_match_cache = new Map<string, boolean>();
	}

	/** Responsibilities: _bounded candidate evaluation_. **/
	public match_candidate(candidate: string): GitIgnoreGlobMatchResult {
		if (candidate.includes("/")) {
			return this.calculate_candidate_match(candidate);
		}
		if (this.candidate_match_cache.has(candidate)) {
			return { matched: this.candidate_match_cache.get(candidate) === true, visited_states: 0 };
		}
		const result = this.calculate_candidate_match(candidate);
		this.candidate_match_cache.set(candidate, result.matched);
		return result;
	}

	/** Responsibilities: _candidate segment matching_. **/
	public match_segments(candidate: string): GitIgnoreGlobMatchResult {
		let visited_states = 0;
		for (const segment of candidate.split("/")) {
			const result = this.match_candidate(segment);
			visited_states += result.visited_states;
			if (result.matched) {
				return { matched: true, visited_states };
			}
		}
		return { matched: false, visited_states };
	}
}
