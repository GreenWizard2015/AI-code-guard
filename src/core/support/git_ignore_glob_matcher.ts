import type { GitIgnoreGlobMatcherContract, GitIgnoreGlobTokenContract } from "src/runtime_protocols";
import type { GitIgnoreGlobMatchResult } from "src/project_analysis_types";

/** Responsibilities: _bounded Gitignore glob matching_, _path segment matching_. **/
export class GitIgnoreGlobMatcher implements GitIgnoreGlobMatcherContract {
	private readonly tokens: readonly GitIgnoreGlobTokenContract[];
	private readonly candidate_match_cache: Map<string, boolean>;

	/** Responsibilities: _token suffix evaluation_. **/
	private append_token_row(
		token: GitIgnoreGlobTokenContract,
		candidate: string,
		current_row: Uint8Array,
		next_row: Uint8Array,
	): void {
		for (let index = candidate.length; index >= 0; index -= 1) {
			current_row[index] = token.advance(candidate, index, current_row, next_row) ? 1 : 0;
		}
	}

	/** Responsibilities: _initial dynamic-programming match row_. **/
	private initial_match_row(candidate_length: number): Uint8Array {
		const row = new Uint8Array(candidate_length + 1);
		row[candidate_length] = 1;
		return row;
	}

	/** Responsibilities: _candidate state evaluation_. **/
	private calculate_candidate_match(candidate: string): GitIgnoreGlobMatchResult {
		let next_row: Uint8Array = this.initial_match_row(candidate.length);
		let current_row: Uint8Array = new Uint8Array(next_row.length);
		let visited_states = next_row.length;
		for (let token_index = this.tokens.length - 1; token_index >= 0; token_index -= 1) {
			const token = this.tokens[token_index];
			if (token === undefined) {
				continue;
			}
			this.append_token_row(token, candidate, current_row, next_row);
			visited_states += current_row.length;
			const previous_row = next_row;
			next_row = current_row;
			current_row = previous_row;
		}
		return { matched: next_row[0] === 1, visited_states };
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
