import { TypeScriptOperatorPrecedence } from 'src/bridge/ts/parser-internals/typescript-operator-precedence';
import { TypeScriptLogicalChain } from 'src/bridge/ts/parser-internals/typescript-logical-chain';
import {
	INDEX_SIGNATURE,
	INTERFACE_RULE_ID,
	UNBOUNDED_TYPE,
} from 'src/bridge/ts/parser-internals/constants';
import ts from 'typescript';
import type { CallableShapeCounts, RuleAppender, RuleContextData } from 'src/types';

/** Responsibilities: _classification TypeScript structural members_. **/
export class TypeScriptStructuralRules {
	private readonly data_member_kinds = new Set([
		ts.SyntaxKind.PropertySignature,
		ts.SyntaxKind.IndexSignature,
	]);
	private readonly logical_chain = new TypeScriptLogicalChain();
	private readonly operator_precedence = new TypeScriptOperatorPrecedence();

	/** Responsibilities: _classification type member storage_. **/
	private is_data_member(member: ts.TypeElement): boolean {
		if (!this.data_member_kinds.has(member.kind)) {
			return false;
		}
		if (ts.isPropertySignature(member)) {
			return true;
		}
		return ts.isIndexSignatureDeclaration(member);
	}

	/** Responsibilities: _classification type member callable_. **/
	private is_callable_member(member: ts.TypeElement): boolean {
		if (ts.isCallSignatureDeclaration(member)) {
			return true;
		}
		if (ts.isMethodSignature(member)) {
			return true;
		}
		return this.callable_property(member);
	}

	/** Responsibilities: _callable data member count_. **/
	private callable_shape_counts(node: ts.TypeAliasDeclaration): CallableShapeCounts {
		const counts = { callables: 0, data: 0 };
		if (!ts.isTypeLiteralNode(node.type)) {
			return counts;
		}
		for (const member of node.type.members) {
			if (this.is_callable_member(member)) {
				counts.callables += 1;
			} else if (this.is_data_member(member)) {
				counts.data += 1;
			}
		}
		return counts;
	}

	/** Responsibilities: _classification property signature whose_. **/
	private callable_property(member: ts.TypeElement): boolean {
		if (!ts.isPropertySignature(member)) {
			return false;
		}
		if (member.type === undefined) {
			return false;
		}
		return ts.isFunctionTypeNode(member.type);
	}

	/** Responsibilities: _classification node nested inside_. **/
	private inside_callable_body(node: ts.Node): boolean {
		let current: ts.Node | undefined = node.parent;
		while (current !== undefined) {
			if (ts.isFunctionLike(current)) {
				if (!('body' in current) || current.body === undefined) {
					return false;
				}
				return current.body.getStart() <= node.getStart();
			}
			current = current.parent;
		}
		return false;
	}

	/** Responsibilities: _classification node usage unbounded_. **/
	private is_unbounded_type(node: ts.Node): boolean {
		if (node.kind === ts.SyntaxKind.AnyKeyword || node.kind === ts.SyntaxKind.UnknownKeyword) {
			return true;
		}
		if (node.kind === ts.SyntaxKind.ObjectKeyword) {
			return true;
		}
		if (!ts.isTypeReferenceNode(node)) {
			return false;
		}
		if (node.typeName.getText() === 'object') {
			return true;
		}
		return node.typeName.getText() === 'Object';
	}

	/** Responsibilities: _aggregation interface-shape rules type_. **/
	private append_interface_shape(node: ts.Node, test_file: boolean, append_rule: RuleAppender): void {
		if (test_file) {
			return;
		}
		if (!ts.isTypeAliasDeclaration(node)) {
			return;
		}
		if (!ts.isTypeLiteralNode(node.type)) {
			return;
		}
		const counts = this.callable_shape_counts(node);
		const callable_only = counts.callables > 3 && counts.data === 0;
		const empty_shape = counts.callables === 0 && counts.data === 0;
		if (callable_only || empty_shape) {
			append_rule(node, INTERFACE_RULE_ID);
		}
	}

	/** Responsibilities: _aggregation type-level structural rules_. **/
	public append_type_rules(node: ts.Node, context: RuleContextData): void {
		const is_unbounded = this.is_unbounded_type(node);
		if (is_unbounded && !this.inside_callable_body(node)) {
			context.append_rule(node, UNBOUNDED_TYPE);
		}
		if (ts.isIndexSignatureDeclaration(node)) {
			context.append_rule(node, INDEX_SIGNATURE);
		}
		if (ts.isTypeAliasDeclaration(node)) {
			this.append_interface_shape(node, context.test_file, context.append_rule);
		}
	}

	/** Responsibilities: _aggregation structural rules applicable_. **/
	public append(node: ts.Node, context: RuleContextData): void {
		if (this.logical_chain.long_chain(node)) {
			context.append_rule(node, 'logical-chain-size');
		}
		if (this.operator_precedence.mixed_boolean_operator(node)) {
			context.append_rule(node, 'mixed-boolean-precedence');
		}
		if (this.operator_precedence.mixed_arithmetic_operator(node)) {
			context.append_rule(node, 'mixed-arithmetic-precedence');
		}
		this.append_type_rules(node, context);
	}
}
