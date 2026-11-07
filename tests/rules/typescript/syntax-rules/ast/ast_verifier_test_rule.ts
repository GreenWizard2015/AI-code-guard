import type { ASTSourceRuleContract } from "src/ast_verifier_protocols";
import type { TypeScriptNodeVerificationRequest } from "src/typescript_analysis_types";

/** Responsibilities: _AST verifier registration fixture_, _path match observation_. **/
export class ASTVerifierTestRule implements ASTSourceRuleContract {
	private readonly _source_pattern: RegExp;
	private _match_count: number;

	/** Responsibilities: _AST test rule configuration_. **/
	public constructor(source_pattern: RegExp) {
		this._source_pattern = source_pattern;
		this._match_count = 0;
	}

	/** Responsibilities: _test rule source selection_. **/
	public active_for(source_code: string): boolean {
		return this._source_pattern.test(source_code);
	}

	/** Responsibilities: _test path match recording_. **/
	public verify(_request: TypeScriptNodeVerificationRequest): void {
		this._match_count += 1;
	}

	/** Responsibilities: _test match count access_. **/
	public match_count(): number {
		return this._match_count;
	}
}
