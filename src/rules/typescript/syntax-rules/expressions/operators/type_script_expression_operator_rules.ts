import { TYPESCRIPT_PROTOTYPE_NAME } from "src/constants";
import { RULE_IDS } from "src/linting/constants";
import { INSTANCEOF } from "src/parser/internals/constants";
import { TypeScriptConditionExpression } from "src/parser/internals/type_script_condition_expression";
import { TypeScriptCallableFeatureDetection } from "src/rules/typescript/syntax-rules/callables/type_script_callable_feature_detection";
import { DynamicBindingNames } from "src/rules/typescript/syntax-rules/expressions/operators/dynamic_binding_names";
import { TypeScriptInOperatorAliases } from "src/rules/typescript/syntax-rules/expressions/operators/type_script_in_operator_aliases";
import { TypeScriptStructuralDowncast } from "src/rules/typescript/syntax-rules/types/structural/type_script_structural_downcast";
import type { CallableRuleAppender } from "src/types";
import type { TypeScriptExpressionRuleContract } from "src/typescript_runtime_protocols";
import type { TypeScriptObjectAliasDeclarationIndexContract } from "src/typescript_runtime_protocols";
import ts from "typescript";

/** Responsibilities: _operator boundary rules_, _callable feature detection_. **/
export class TypeScriptExpressionOperatorRules implements TypeScriptExpressionRuleContract {
	private readonly _in_operator_aliases: TypeScriptInOperatorAliases;
	private readonly _condition_expression: TypeScriptConditionExpression;
	private readonly _callable_feature_detection: TypeScriptCallableFeatureDetection;
	private readonly _protocol_downcast: TypeScriptStructuralDowncast;
	private readonly _callable_feature_kinds: ReadonlySet<ts.SyntaxKind>;
	private readonly _membership_kinds: ReadonlySet<ts.SyntaxKind>;

	/** Responsibilities: _conditional in-operator classification_. **/
	private condition_in_operator(
		expression: ts.Expression,
		condition_node: ts.Node,
		source_file: ts.SourceFile,
	): boolean {
		if (ts.isBinaryExpression(expression)) {
			return this._in_operator_aliases.invalid(expression, source_file);
		}
		if (ts.isIdentifier(expression)) {
			return this._in_operator_aliases.aliases(condition_node).has(expression.text);
		}
		return false;
	}

	/** Responsibilities: _dynamic in-operator classification_. **/
	private in_operator(condition_node: ts.Node, source_file: ts.SourceFile): boolean {
		if (ts.isIfStatement(condition_node)) {
			const expression = this._condition_expression.unwrap(condition_node.expression);
			return this.condition_in_operator(expression, condition_node, source_file);
		}
		if (!ts.isBinaryExpression(condition_node)) {
			if (!ts.isIdentifier(condition_node)) {
				return false;
			}
			return this._in_operator_aliases.aliases(condition_node).has(condition_node.text);
		}
		const expression = this._condition_expression.unwrap(condition_node);
		return this.condition_in_operator(expression, condition_node, source_file);
	}

	/** Responsibilities: _prototype member classification_. **/
	private prototype_member(expression: ts.Expression): boolean {
		if (ts.isPropertyAccessExpression(expression)) {
			return expression.name.text === TYPESCRIPT_PROTOTYPE_NAME;
		}
		if (!ts.isElementAccessExpression(expression)) {
			return false;
		}
		const argument = expression.argumentExpression;
		if (!ts.isStringLiteral(argument)) {
			return false;
		}
		return argument.text === TYPESCRIPT_PROTOTYPE_NAME;
	}

	/** Responsibilities: _prototype check classification_. **/
	private prototype_check(call: ts.CallExpression): boolean {
		if (!ts.isPropertyAccessExpression(call.expression)) {
			return false;
		}
		if (call.expression.name.text !== "isPrototypeOf") {
			return false;
		}
		return this.prototype_member(call.expression.expression);
	}

	/** Responsibilities: _callable feature presence_. **/
	private has_callable_feature(feature_candidate: ts.Node): boolean {
		if (!this._callable_feature_kinds.has(feature_candidate.kind)) {
			return false;
		}
		return this._callable_feature_detection.feature_detection(feature_candidate);
	}

	/** Responsibilities: _membership alias presence_. **/
	private has_membership_alias(membership_candidate: ts.Node): boolean {
		if (!this._membership_kinds.has(membership_candidate.kind)) {
			return false;
		}
		if (!ts.isIfStatement(membership_candidate) && !ts.isBinaryExpression(membership_candidate)) {
			return false;
		}
		return this.in_operator(membership_candidate, membership_candidate.getSourceFile());
	}

	/** Responsibilities: _operator analyzer dependency initialization_. **/
	public constructor(declaration_index: TypeScriptObjectAliasDeclarationIndexContract) {
		this._in_operator_aliases = new TypeScriptInOperatorAliases(new DynamicBindingNames());
		this._condition_expression = new TypeScriptConditionExpression();
		this._callable_feature_detection = new TypeScriptCallableFeatureDetection(declaration_index);
		this._protocol_downcast = new TypeScriptStructuralDowncast();
		this._callable_feature_kinds = new Set([
			ts.SyntaxKind.IfStatement,
			ts.SyntaxKind.WhileStatement,
			ts.SyntaxKind.DoStatement,
			ts.SyntaxKind.ForStatement,
			ts.SyntaxKind.ConditionalExpression,
		]);
		this._membership_kinds = new Set([
			ts.SyntaxKind.IfStatement,
			ts.SyntaxKind.WhileStatement,
			ts.SyntaxKind.DoStatement,
			ts.SyntaxKind.ForStatement,
			ts.SyntaxKind.BinaryExpression,
		]);
	}

	/** Responsibilities: _operator rule collection_. **/
	public append(candidate: ts.Node, append_rule: CallableRuleAppender): void {
		if (this.has_callable_feature(candidate)) {
			append_rule(candidate, RULE_IDS.callable_feature_detection);
		}
		if (this.has_membership_alias(candidate)) {
			append_rule(candidate, RULE_IDS.typescript_in_operator);
		}
		if (ts.isBinaryExpression(candidate) && candidate.operatorToken.kind === ts.SyntaxKind.InstanceOfKeyword) {
			if (this._protocol_downcast.reports(candidate)) {
				append_rule(candidate, RULE_IDS.protocol_downcast_to_implementation);
				return;
			}
			append_rule(candidate, INSTANCEOF);
		}
		if (ts.isCallExpression(candidate) && this.prototype_check(candidate)) {
			append_rule(candidate, INSTANCEOF);
		}
	}
}
