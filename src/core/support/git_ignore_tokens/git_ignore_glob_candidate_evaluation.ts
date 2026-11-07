import type { GitIgnoreGlobMatchResult } from "src/project_analysis_types";
import type { GitIgnoreGlobCandidateEvaluationContract, GitIgnoreGlobTokenContract } from "src/runtime_protocols";

/** Responsibilities: _candidate ownership_, _dynamic-programming evaluation_. **/
export class GitIgnoreGlobCandidateEvaluation implements GitIgnoreGlobCandidateEvaluationContract {
	private readonly _tokens: readonly GitIgnoreGlobTokenContract[];
	private readonly _candidate: string;
	private readonly _initial_row: Uint8Array;
	private readonly _scratch_row: Uint8Array;

	/** Responsibilities: _active row selection_. **/
	private row(active_row: number): Uint8Array {
		if (active_row % 2 === 0) {
			return this._initial_row;
		}
		return this._scratch_row;
	}

	/** Responsibilities: _token state advancement_. **/
	private advance_token(token: GitIgnoreGlobTokenContract, active_row: number): number {
		const current_row = this.row(active_row + 1);
		const next_row = this.row(active_row);
		token.advance_row(this._candidate, current_row, next_row);
		return current_row.length;
	}

	/** Responsibilities: _candidate matcher initialization_. **/
	public constructor(tokens: readonly GitIgnoreGlobTokenContract[], candidate: string) {
		this._tokens = tokens;
		this._candidate = candidate;
		this._initial_row = new Uint8Array(candidate.length + 1);
		this._initial_row[candidate.length] = 1;
		this._scratch_row = new Uint8Array(this._initial_row.length);
	}

	/** Responsibilities: _candidate match result_. **/
	public match(): GitIgnoreGlobMatchResult {
		let active_row = 0;
		let visited_states = this._initial_row.length;
		for (let token_index = this._tokens.length - 1; token_index >= 0; token_index -= 1) {
			const token = this._tokens[token_index];
			if (token === undefined) {
				continue;
			}
			visited_states += this.advance_token(token, active_row);
			active_row += 1;
		}
		const final_row = this.row(active_row);
		return { matched: final_row[0] === 1, visited_states };
	}

	/** Responsibilities: _fixed-width glob evaluation_. **/
	public match_fixed_width(): GitIgnoreGlobMatchResult {
		let active_row = 0;
		for (let token_index = this._tokens.length - 1; token_index >= 0; token_index -= 1) {
			const token = this._tokens[token_index];
			if (token !== undefined) {
				const current_row = this.row(active_row + 1);
				const next_row = this.row(active_row);
				current_row[token_index] = token.advance(this._candidate, token_index, current_row, next_row) ? 1 : 0;
			}
			active_row += 1;
		}
		const final_row = this.row(active_row);
		return { matched: final_row[0] === 1, visited_states: this._tokens.length + 1 };
	}
}
