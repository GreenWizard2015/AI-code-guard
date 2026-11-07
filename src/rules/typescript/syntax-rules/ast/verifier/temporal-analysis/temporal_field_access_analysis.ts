import {
	TEMPORAL_FIELD_READ_EFFECT,
	TEMPORAL_FIELD_READ_WRITE_EFFECT,
	TEMPORAL_FIELD_WRITE_EFFECT,
} from "src/constants";
import type { TemporalFieldAccess } from "src/contracts/types/type_script_rule_group_types";
import type { TemporalFieldEffect } from "src/model_types";
import ts from "typescript";

/** Responsibilities: _single field access_, _read-write effect classification_. **/
export class TemporalFieldAccessAnalysis {
	private readonly _node: ts.Node;

	/** Responsibilities: _binary field effect_. **/
	private binary_effect(parent: ts.Node): TemporalFieldEffect {
		if (!ts.isBinaryExpression(parent) || parent.left !== this._node) {
			return TEMPORAL_FIELD_READ_EFFECT;
		}
		const operator = parent.operatorToken.kind;
		if (operator < ts.SyntaxKind.FirstAssignment || operator > ts.SyntaxKind.LastAssignment) {
			return TEMPORAL_FIELD_READ_EFFECT;
		}
		if (operator === ts.SyntaxKind.EqualsToken) {
			return TEMPORAL_FIELD_WRITE_EFFECT;
		}
		return TEMPORAL_FIELD_READ_WRITE_EFFECT;
	}

	/** Responsibilities: _unary field effect_. **/
	private unary_effect(parent: ts.Node): TemporalFieldEffect {
		let operator: ts.SyntaxKind;
		let operand: ts.Node;
		if (ts.isPrefixUnaryExpression(parent) || ts.isPostfixUnaryExpression(parent)) {
			operator = parent.operator;
			operand = parent.operand;
		} else {
			return TEMPORAL_FIELD_READ_EFFECT;
		}
		if (operand !== this._node) {
			return TEMPORAL_FIELD_READ_EFFECT;
		}
		if (operator !== ts.SyntaxKind.PlusPlusToken && operator !== ts.SyntaxKind.MinusMinusToken) {
			return TEMPORAL_FIELD_READ_EFFECT;
		}
		return TEMPORAL_FIELD_READ_WRITE_EFFECT;
	}

	/** Responsibilities: _field access initialization_. **/
	public constructor(node: ts.Node) {
		this._node = node;
	}

	/** Responsibilities: _field access effect_. **/
	public effect(): TemporalFieldEffect {
		if (ts.isBinaryExpression(this._node.parent)) {
			return this.binary_effect(this._node.parent);
		}
		return this.unary_effect(this._node.parent);
	}

	/** Responsibilities: _this field access effect_. **/
	public access(): TemporalFieldAccess {
		if (!ts.isPropertyAccessExpression(this._node)) {
			return { present: false, name: "", read: false, write: false };
		}
		if (this._node.expression.kind !== ts.SyntaxKind.ThisKeyword) {
			return { present: false, name: "", read: false, write: false };
		}
		const effect = this.effect();
		return { present: true, name: this._node.name.text, ...effect };
	}
}
