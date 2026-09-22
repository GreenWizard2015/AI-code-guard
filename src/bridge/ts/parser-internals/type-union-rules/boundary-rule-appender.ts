import { TypeScriptBasicRules } from 'src/bridge/ts/parser-internals/type-union-rules/typescript-basic-rules';
import { NullableTypeRules } from 'src/bridge/ts/parser-internals/type-union-rules/nullable-type-rules';
import { UnionContractBypass } from 'src/bridge/ts/parser-internals/type-union-rules/union-contract-bypass';
import { CompositeStateTypeRules } from 'src/bridge/ts/parser-internals/type-union-rules/composite-state-type';
import {
	COMPOSITE_STATE_TYPE,
	EXCEPTION_RAISING,
	GETATTR,
	LARGE_UNION,
	NULLABLE_DOMAIN_TYPE,
	SETATTR,
	UNION_CONTRACT_BYPASS,
} from 'src/bridge/ts/parser-internals/constants';
import ts from 'typescript';
import type { RuleContextData } from 'src/types';

/** Responsibilities: _aggregation TypeScript invocation union_. **/
export class TypeScriptBoundaryRuleAppender {
	private readonly max_union_types = 3;
	private readonly basic_rules = new TypeScriptBasicRules();
	private readonly nullable_type_rules = new NullableTypeRules();
	private readonly union_contract_bypass = new UnionContractBypass();
	private readonly composite_state_type = new CompositeStateTypeRules();

	/** Responsibilities: _aggregation callable boundary rules_. **/
	private append_call_rules(node: ts.Node, context: RuleContextData): void {
		if (ts.isCallExpression(node)) {
			if (!ts.isIdentifier(node.expression)) {
				return;
			}
			if (node.expression.text === 'getattr') {
				context.append_rule(node, GETATTR);
			}
			if (node.expression.text === 'setattr') {
				context.append_rule(node, SETATTR);
			}
		}
		if (ts.isUnionTypeNode(node) && node.types.length > this.max_union_types) {
			context.append_rule(node, LARGE_UNION);
		}
	}

	/** Responsibilities: _aggregation union nullable boundary_. **/
	private append_union_rules(node: ts.Node, context: RuleContextData): void {
		if (this.nullable_type_rules.nullable_type(node)) {
			context.append_rule(node, NULLABLE_DOMAIN_TYPE);
		}
		if (this.union_contract_bypass.bypass(node)) {
			context.append_rule(node, UNION_CONTRACT_BYPASS);
		}
		if (this.composite_state_type.violation(node)) {
			context.append_rule(node, COMPOSITE_STATE_TYPE);
		}
	}

	/** Responsibilities: _aggregation basic type boundary_. **/
	private append_basic_rules(node: ts.Node, context: RuleContextData): void {
		if (ts.isPropertyDeclaration(node) || ts.isPropertySignature(node)) {
			this.basic_rules.append_alias_rules(node, context.append_rule);
		}
		if (ts.isParameter(node)) {
			this.basic_rules.append_parameter_rules(node, context.append_rule);
		}
		this.basic_rules.append_expression_rules(node, context.append_rule);
		if (context.test_file && ts.isThrowStatement(node)) {
			context.append_rule(node, EXCEPTION_RAISING);
		}
	}

	/** Responsibilities: _aggregation inline composite union_. **/
	private append_union_types(node: ts.Node, context: RuleContextData): void {
		if (!this.union_rules_apply(node)) {
			return;
		}
		this.append_call_rules(node, context);
		if (ts.isParameter(node) || ts.isPropertyDeclaration(node) || ts.isPropertySignature(node)) {
			this.append_union_rules(node, context);
			return;
		}
		if (ts.isUnionTypeNode(node) || ts.isIntersectionTypeNode(node)) {
			this.append_union_rules(node, context);
		}
	}

	/** Responsibilities: _aggregation boundary rules applicable_. **/
	public append(node: ts.Node, context: RuleContextData): void {
		this.append_basic_rules(node, context);
		this.append_union_types(node, context);
	}

	/** Responsibilities: _reporting union boundary rules_. **/
	public union_rules_apply(node: ts.Node): boolean {
		if (ts.isCallExpression(node) || ts.isUnionTypeNode(node) || ts.isIntersectionTypeNode(node)) {
			return true;
		}
		return ts.isParameter(node) || ts.isPropertyDeclaration(node) || ts.isPropertySignature(node);
	}
}
