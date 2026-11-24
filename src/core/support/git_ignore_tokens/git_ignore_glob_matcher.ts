import { GitIgnoreGlobCandidateEvaluation } from "src/core/support/git_ignore_tokens/git_ignore_glob_candidate_evaluation";
import type { GitIgnoreGlobMatchResult } from "src/project_analysis_types";
import type {
	GitIgnoreGlobCandidateEvaluationContract,
	GitIgnoreGlobMatcherContract,
	GitIgnoreGlobTokenContract,
} from "src/runtime_protocols";

/** Responsibilities: _bounded Gitignore glob matching_, _path segment matching_. **/
export class GitIgnoreGlobMatcher implements GitIgnoreGlobMatcherContract {
	private readonly _tokens: readonly GitIgnoreGlobTokenContract[];
	private readonly _candidate_match_cache: Map<string, boolean>;
	private readonly _minimum_candidate_length: number;
	private readonly _variable_candidate_length: boolean;

	/** Responsibilities: _candidate length rejection_. **/
	private candidate_length_impossible(candidate_length: number): boolean {
		if (candidate_length < this._minimum_candidate_length) {
			return true;
		}
		return !this._variable_candidate_length && candidate_length !== this._tokens.length;
	}

	/** Responsibilities: _candidate evaluation dispatch_. **/
	private evaluate(evaluation: GitIgnoreGlobCandidateEvaluationContract): GitIgnoreGlobMatchResult {
		if (this._variable_candidate_length) {
			return evaluation.match();
		}
		return evaluation.match_fixed_width();
	}

	/** Responsibilities: _Gitignore pattern matching_. **/
	public constructor(tokens: readonly GitIgnoreGlobTokenContract[]) {
		this._tokens = tokens;
		this._candidate_match_cache = new Map<string, boolean>();
		this._minimum_candidate_length = tokens.reduce((total, token) => total + token.minimum_candidate_length(), 0);
		this._variable_candidate_length = tokens.some((token) => token.variable_candidate_length());
	}

	/** Responsibilities: _bounded candidate evaluation_. **/
	public match_candidate(candidate: string): GitIgnoreGlobMatchResult {
		const cacheable = !candidate.includes("/");
		if (cacheable) {
			const cached = this._candidate_match_cache.get(candidate);
			if (cached !== undefined) {
				return { matched: cached, visited_states: 0 };
			}
		}
		if (this.candidate_length_impossible(candidate.length)) {
			return { matched: false, visited_states: 0 };
		}
		const evaluation = new GitIgnoreGlobCandidateEvaluation(this._tokens, candidate);
		const result = this.evaluate(evaluation);
		if (cacheable) {
			this._candidate_match_cache.set(candidate, result.matched);
		}
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
