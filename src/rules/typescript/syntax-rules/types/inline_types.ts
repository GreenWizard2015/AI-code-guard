import type { ASTSourceRuleContract } from "src/ast_verifier_protocols";
import { RULE_IDS } from "src/linting/constants";
import type { RuleContextContract } from "src/types";
import { TestPathKind } from "src/types";
import type { TypeScriptNodeVerificationRequest } from "src/typescript_analysis_types";
import ts from "typescript";

type CallableTypeParentCheck = (node: ts.Node) => boolean;
type InlineViolationFlags = { object: boolean; union: boolean; generic: boolean; field_count: number };
/** Responsibilities: _inline type classification_, _nested object diagnostics_. **/
export class InlineTypes implements ASTSourceRuleContract {
	private readonly _object_rule_id: string;
	private readonly _union_rule_id: string;
	private readonly _generic_rule_id: string;
	private readonly _field_count_id: string;
	private readonly _type_parent_checks: readonly CallableTypeParentCheck[];
	private readonly _signature_parents: readonly CallableTypeParentCheck[];

	/** Responsibilities: _inline object classification_. **/
	private object_violation(candidate: ts.Node): boolean {
		if (ts.isTypeLiteralNode(candidate)) {
			const parent = this.type_parent(candidate);
			if (this._type_parent_checks.some((check) => check(parent))) {
				return true;
			}
		}
		if (ts.isClassExpression(candidate)) {
			return true;
		}
		if (ts.isFunctionTypeNode(candidate)) {
			return this._signature_parents.some((check) => check(this.type_parent(candidate)));
		}
		return false;
	}

	/** Responsibilities: _inline type member extraction_. **/
	private type_members(declaration: ts.Node): readonly ts.TypeElement[] {
		if (ts.isInterfaceDeclaration(declaration)) {
			return declaration.members;
		}
		if (ts.isTypeAliasDeclaration(declaration) && ts.isTypeLiteralNode(declaration.type)) {
			return declaration.type.members;
		}
		return [];
	}

	/** Responsibilities: _inline node classification_. **/
	private unwrapped_type(type_node: ts.TypeNode): ts.TypeNode {
		if (ts.isParenthesizedTypeNode(type_node)) {
			return this.unwrapped_type(type_node.type);
		}
		return type_node;
	}

	/** Responsibilities: _inline generic classification_. **/
	private generic_type_node(type_literal: ts.TypeLiteralNode): boolean {
		let parent = type_literal.parent;
		while (ts.isParenthesizedTypeNode(parent)) {
			parent = parent.parent;
		}
		if (!ts.isTypeReferenceNode(parent)) {
			return false;
		}
		if (!parent.typeArguments) {
			return false;
		}
		return parent.typeArguments.some((argument) => this.unwrapped_type(argument) === type_literal);
	}

	/** Responsibilities: _inline union classification_. **/
	private is_inline_union(union_type: ts.UnionTypeNode): boolean {
		if (!this._signature_parents.some((check) => check(this.type_parent(union_type)))) {
			return false;
		}
		return union_type.types.every(ts.isLiteralTypeNode);
	}

	/** Responsibilities: _inline type literal classification_. **/
	private type_parent(type_node: ts.TypeNode): ts.Node {
		let parent = type_node.parent;
		while (ts.isParenthesizedTypeNode(parent)) {
			parent = parent.parent;
		}
		return parent;
	}

	/** Responsibilities: _inline violation classification_. **/
	private violation_flags(source_node: ts.Node): InlineViolationFlags {
		let field_count = 0;
		if (ts.isInterfaceDeclaration(source_node) || ts.isTypeAliasDeclaration(source_node)) {
			field_count = this.type_members(source_node).filter(ts.isPropertySignature).length;
		}
		return {
			object: this.object_violation(source_node),
			union: ts.isUnionTypeNode(source_node) && this.is_inline_union(source_node),
			generic: ts.isTypeLiteralNode(source_node) && this.generic_type_node(source_node),
			field_count,
		};
	}

	/** Responsibilities: _inline violation creation_. **/
	private append_flagged_violations(node: ts.Node, context: RuleContextContract, flags: InlineViolationFlags): void {
		if (flags.object) {
			context.for_node(node).append_rule(this._object_rule_id);
		}
		if (flags.union) {
			context.for_node(node).append_rule(this._union_rule_id);
		}
		if (flags.generic) {
			context.for_node(node).append_rule(this._generic_rule_id);
		}
		if (flags.field_count > 10) {
			context.for_node(node).append_parameterized_rule(this._field_count_id, { count: String(flags.field_count) });
		}
	}

	/** Responsibilities: _inline violation presence_. **/
	private has_violation(flags: InlineViolationFlags): boolean {
		if (flags.object || flags.union) {
			return true;
		}
		if (flags.generic) {
			return true;
		}
		return flags.field_count > 10;
	}

	/** Responsibilities: _inline rule configuration_, _parent predicate configuration_. **/
	public constructor() {
		this._object_rule_id = RULE_IDS.typescript_inline_object_type;
		this._union_rule_id = RULE_IDS.typescript_inline_union_type;
		this._generic_rule_id = RULE_IDS.inline_generic_type;
		this._field_count_id = RULE_IDS.type_field_count;
		this._type_parent_checks = [
			ts.isParameter,
			ts.isPropertySignature,
			ts.isPropertyDeclaration,
			ts.isMethodSignature,
			ts.isFunctionDeclaration,
			ts.isMethodDeclaration,
			ts.isArrowFunction,
			ts.isFunctionExpression,
			ts.isVariableDeclaration,
			ts.isTypeAssertionExpression,
			ts.isAsExpression,
			ts.isSatisfiesExpression,
		];
		this._signature_parents = [
			ts.isParameter,
			ts.isPropertySignature,
			ts.isPropertyDeclaration,
			ts.isFunctionDeclaration,
			ts.isMethodDeclaration,
			ts.isMethodSignature,
			ts.isArrowFunction,
			ts.isFunctionExpression,
		];
	}
	/** Responsibilities: _inline type violation processing_. **/
	public append_node(analyzed_node: ts.Node, context: RuleContextContract): void {
		const flags = this.violation_flags(analyzed_node);
		if (!this.has_violation(flags)) {
			return;
		}
		this.append_flagged_violations(analyzed_node, context, flags);
	}

	/** Responsibilities: _inline rule activation_. **/
	public active_for(source_code: string): boolean {
		return source_code.length > 0;
	}

	/** Responsibilities: _inline type node dispatch_. **/
	public verify(request: TypeScriptNodeVerificationRequest): void {
		if (!request.context.state().source.path_kinds.has(TestPathKind.TypeScriptTestFile)) {
			this.append_node(request.node, request.context);
		}
	}
}
