import ts from "typescript";

import { UnnecessaryUndefinedCheck } from "src/rules/typescript/syntax-rules/runtime/unnecessary_undefined_check";
import { UndefinedCheckCandidate } from "src/rules/typescript/syntax-rules/runtime/undefined_check_candidate";
import type { RuleAppender, TypeScriptRuleContextOptions } from "src/types";
import type { UndefinedCheckCandidateContract, UnnecessaryUndefinedCheckContract } from "src/protocols";

/** Responsibilities: _candidate matching_, _undefined diagnostic emission_. **/
export class UndefinedCheckRules {
	private readonly candidate: UndefinedCheckCandidateContract;
	private readonly checker: UnnecessaryUndefinedCheckContract;
	private readonly candidate_kind_flags: Uint8Array;

	/** Responsibilities: _initialization undefined-check rules_. **/
	public constructor(source_file: ts.SourceFile, append_rule: RuleAppender, options: TypeScriptRuleContextOptions) {
		this.candidate = new UndefinedCheckCandidate();
		this.checker = new UnnecessaryUndefinedCheck(
			source_file,
			append_rule,
			options.source_resolver,
			options.module_exports,
			options.source_index,
		);
		this.candidate_kind_flags = new Uint8Array(ts.SyntaxKind.Count + 1);
		this.candidate_kind_flags[ts.SyntaxKind.BinaryExpression] = 1;
		this.candidate_kind_flags[ts.SyntaxKind.PropertyAccessExpression] = 1;
		this.candidate_kind_flags[ts.SyntaxKind.ElementAccessExpression] = 1;
	}

	/** Responsibilities: _classification undefined-check candidate_. **/
	public matches(node: ts.Node): boolean {
		if (this.candidate_kind_flags[node.kind] !== 1) {
			return false;
		}
		return this.candidate.matches(node);
	}

	/** Responsibilities: _collection unnecessary undefined check_. **/
	public append(node: ts.Node): void {
		if (!this.matches(node)) {
			return;
		}
		this.checker.append(node);
	}
}
