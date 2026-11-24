import type { Assignment } from "src/model_types";
import ts from "typescript";

/** Responsibilities: _single assignment return detection_, _assignment-chain return detection_. **/
export class TypeScriptPointlessAssignmentCandidates {
	private readonly _candidates: Assignment[];
	private readonly _returned_name: string;
	private readonly _function_initializer_kinds: ReadonlySet<ts.SyntaxKind>;

	/** Responsibilities: _initializer logical-operation check_. **/
	private is_logical_expression(node: ts.Node): boolean {
		if (!ts.isBinaryExpression(node)) {
			return false;
		}
		if (node.operatorToken.kind === ts.SyntaxKind.AmpersandAmpersandToken) {
			return true;
		}
		if (node.operatorToken.kind === ts.SyntaxKind.BarBarToken) {
			return true;
		}
		return node.operatorToken.kind === ts.SyntaxKind.QuestionQuestionToken;
	}

	/** Responsibilities: _initializer identifier collection_. **/
	private identifier_names(node: ts.Node): Set<string> {
		const names = new Set<string>();
		const visit = (child: ts.Node): void => {
			if (ts.isIdentifier(child)) {
				names.add(child.text);
			}
			ts.forEachChild(child, visit);
		};
		visit(node);
		return names;
	}

	/** Responsibilities: _final assignment eligibility_. **/
	private rejects_last_assignment(last: Assignment): boolean {
		if (last.name !== this._returned_name) {
			return true;
		}
		if (last.destructured) {
			return true;
		}
		return this._function_initializer_kinds.has(last.initializer.kind);
	}

	/** Responsibilities: _assignment reuse verification_. **/
	private reuses_prior_assignments(last: Assignment): boolean {
		if (this._candidates.slice(1).every((candidate) => candidate.simple_alias)) {
			return true;
		}
		const names = this.identifier_names(last.initializer);
		return this._candidates.slice(0, -1).every((candidate) => names.has(candidate.name));
	}

	/** Responsibilities: _candidate-state initialization_. **/
	public constructor(
		candidates: Assignment[],
		returned_name: string,
		function_initializer_kinds: ReadonlySet<ts.SyntaxKind>,
	) {
		this._candidates = candidates;
		this._returned_name = returned_name;
		this._function_initializer_kinds = function_initializer_kinds;
	}

	/** Responsibilities: _single assignment state check_. **/
	/** Responsibilities: _single assignment return match_. **/
	public pointless_single_assignment(): boolean {
		if (this._candidates.length !== 1) {
			return false;
		}
		for (const candidate of this._candidates) {
			return candidate.name === this._returned_name && !this.is_logical_expression(candidate.initializer);
		}
		return false;
	}

	/** Responsibilities: _assignment chain return match_. **/
	public pointless_assignment_chain(): boolean {
		if (this._candidates.length <= 1) {
			return false;
		}
		const last = this._candidates.at(-1);
		if (last === undefined || this.rejects_last_assignment(last)) {
			return false;
		}
		return this.reuses_prior_assignments(last);
	}
}
