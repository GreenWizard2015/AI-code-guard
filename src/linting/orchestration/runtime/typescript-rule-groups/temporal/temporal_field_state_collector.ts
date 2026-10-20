import ts from "typescript";
import type {
	TemporalCallableState,
	TemporalFieldAccess,
} from "src/linting/orchestration/runtime/typescript-rule-groups/types";
import {
	TEMPORAL_FIELD_READ_EFFECT,
	TEMPORAL_FIELD_READ_WRITE_EFFECT,
	TEMPORAL_FIELD_WRITE_EFFECT,
} from "src/constants";
import type { TemporalFieldEffect } from "src/model/types/types";

/** Responsibilities: _field access analysis_, _callable state aggregation_. **/
export class TemporalFieldStateCollector {
	private readonly source_file: ts.SourceFile;

	/** Responsibilities: _assignment operator classification_. **/
	private assignment_operator(kind: ts.SyntaxKind): boolean {
		const first_assignment = ts.SyntaxKind.FirstAssignment;
		const last_assignment = ts.SyntaxKind.LastAssignment;
		return kind >= first_assignment && kind <= last_assignment;
	}

	/** Responsibilities: _increment operator classification_. **/
	private increment_operator(kind: ts.SyntaxKind): boolean {
		const is_increment = kind === ts.SyntaxKind.PlusPlusToken;
		const is_decrement = kind === ts.SyntaxKind.MinusMinusToken;
		return is_increment || is_decrement;
	}

	/** Responsibilities: _binary field effect classification_. **/
	private binary_effect(node: ts.Node, parent: ts.Node): TemporalFieldEffect {
		if (!ts.isBinaryExpression(parent)) {
			return TEMPORAL_FIELD_READ_EFFECT;
		}
		const is_left_operand = parent.left === node;
		if (!is_left_operand) {
			return TEMPORAL_FIELD_READ_EFFECT;
		}
		if (!this.assignment_operator(parent.operatorToken.kind)) {
			return TEMPORAL_FIELD_READ_EFFECT;
		}
		if (parent.operatorToken.kind === ts.SyntaxKind.EqualsToken) {
			return TEMPORAL_FIELD_WRITE_EFFECT;
		}
		return TEMPORAL_FIELD_READ_WRITE_EFFECT;
	}

	/** Responsibilities: _unary field effect classification_. **/
	private unary_effect(node: ts.Node, parent: ts.Node): TemporalFieldEffect {
		if (ts.isPrefixUnaryExpression(parent)) {
			return this.increment_effect(node, parent.operand, parent.operator);
		}
		if (ts.isPostfixUnaryExpression(parent)) {
			return this.increment_effect(node, parent.operand, parent.operator);
		}
		return TEMPORAL_FIELD_READ_EFFECT;
	}

	/** Responsibilities: _increment field effect classification_. **/
	private increment_effect(node: ts.Node, operand: ts.Node, operator: ts.SyntaxKind): TemporalFieldEffect {
		if (operand !== node) {
			return TEMPORAL_FIELD_READ_EFFECT;
		}
		if (!this.increment_operator(operator)) {
			return TEMPORAL_FIELD_READ_EFFECT;
		}
		return TEMPORAL_FIELD_READ_WRITE_EFFECT;
	}

	/** Responsibilities: _field access classification_. **/
	private field_access(node: ts.Node): TemporalFieldAccess {
		if (!ts.isPropertyAccessExpression(node)) {
			return { present: false, name: "", read: false, write: false };
		}
		if (node.expression.kind !== ts.SyntaxKind.ThisKeyword) {
			return { present: false, name: "", read: false, write: false };
		}
		let effect: TemporalFieldEffect;
		if (ts.isBinaryExpression(node.parent)) {
			effect = this.binary_effect(node, node.parent);
		} else {
			effect = this.unary_effect(node, node.parent);
		}
		return { present: true, name: node.name.text, ...effect };
	}

	/** Responsibilities: _callable field state_. **/
	private callable_state(node: ts.Node): TemporalCallableState {
		const writes = new Set<string>();
		const reads = new Set<string>();
		const visit = (current: ts.Node): void => {
			if (current !== node && (ts.isFunctionLike(current) || ts.isClassDeclaration(current))) {
				return;
			}
			const access = this.field_access(current);
			if (access.present) {
				if (access.read) {
					reads.add(access.name);
				}
				if (access.write) {
					writes.add(access.name);
				}
			}
			current.forEachChild(visit);
		};
		visit(node);
		return { node, writes, reads };
	}

	/** Responsibilities: _callable member classification_. **/
	private is_callable_member(node: ts.Node): boolean {
		if (ts.isMethodDeclaration(node)) {
			return true;
		}
		if (ts.isConstructorDeclaration(node)) {
			return true;
		}
		if (ts.isGetAccessorDeclaration(node)) {
			return true;
		}
		return ts.isSetAccessorDeclaration(node);
	}

	/** Responsibilities: _field initialization_. **/
	public constructor(source_file: ts.SourceFile) {
		this.source_file = source_file;
	}

	/** Responsibilities: _class callable state collection_. **/
	public callables(node: ts.ClassDeclaration): TemporalCallableState[] {
		const result: TemporalCallableState[] = [];
		for (const member of node.members) {
			if (this.is_callable_member(member)) {
				result.push({ ...this.callable_state(member), node: member });
			}
		}
		return result;
	}

	/** Responsibilities: _field state_. **/
	public initialized_fields(node: ts.ClassDeclaration): Set<string> {
		const initialized = new Set<string>();
		for (const member of node.members) {
			if (!ts.isPropertyDeclaration(member)) {
				continue;
			}
			if (member.initializer !== undefined) {
				initialized.add(member.name.getText(this.source_file));
			}
		}
		return initialized;
	}
}
