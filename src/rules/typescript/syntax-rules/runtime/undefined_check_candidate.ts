import ts from "typescript";

import type { UndefinedCheckCandidateContract } from "src/analysis_protocols";
import { UNDEFINED_TYPE_NAME } from "src/metrics/constants";

/** Responsibilities: _comparison candidate detection_, _optional access candidate detection_. **/
export class UndefinedCheckCandidate implements UndefinedCheckCandidateContract {
	/** Responsibilities: _undefined comparison operator classification_. **/
	private comparison_operator(kind: ts.SyntaxKind): boolean {
		switch (kind) {
			case ts.SyntaxKind.EqualsEqualsEqualsToken:
			case ts.SyntaxKind.ExclamationEqualsEqualsToken:
			case ts.SyntaxKind.EqualsEqualsToken:
			case ts.SyntaxKind.ExclamationEqualsToken:
				return true;
			default:
				return false;
		}
	}

	/** Responsibilities: _binary undefined comparison classification_. **/
	private binary_candidate(node: ts.BinaryExpression): boolean {
		if (!this.comparison_operator(node.operatorToken.kind)) {
			return false;
		}
		if (ts.isIdentifier(node.left)) {
			if (node.left.text === UNDEFINED_TYPE_NAME) {
				return true;
			}
		}
		if (ts.isIdentifier(node.right)) {
			if (node.right.text === UNDEFINED_TYPE_NAME) {
				return true;
			}
		}
		return false;
	}

	/** Responsibilities: _optional access classification_. **/
	private optional_access_candidate(node: ts.Node): boolean {
		if (ts.isPropertyAccessExpression(node)) {
			return node.questionDotToken !== undefined;
		}
		if (ts.isElementAccessExpression(node)) {
			return node.questionDotToken !== undefined;
		}
		return false;
	}

	/** Responsibilities: _undefined check candidate matching_. **/
	public matches(node: ts.Node): boolean {
		if (ts.isBinaryExpression(node)) {
			return this.binary_candidate(node);
		}
		return this.optional_access_candidate(node);
	}
}
