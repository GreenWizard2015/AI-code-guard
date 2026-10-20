import { TYPESCRIPT_PROTOTYPE_NAME } from "src/constants";
import { TypeScriptProxyExpressions } from "src/rules/typescript/syntax-rules/callables/type_script_proxy_expressions";
import { PrototypeAliasAnalysis } from "src/rules/typescript/syntax-rules/runtime/prototype_alias_analysis";
import { PrototypeAliasScope } from "src/rules/typescript/syntax-rules/runtime/prototype_alias_scope";
import { TypeScriptStaticExpressionOperations } from "src/typescript-aliases/callables/type_script_static_expression_operations";
import { TypeScriptStaticExpressionValues } from "src/typescript-aliases/callables/type_script_static_expression_values";
import { TypeScriptExpressionAliases } from "src/typescript-aliases/type_script_expression_aliases";
import type { TypeScriptProxyExpressionsContract } from "src/typescript_analysis_protocols";
import ts from "typescript";

/** Responsibilities: _prototype mutation recognition_, _prototype alias analysis_. **/
export class PrototypePredicates {
	private readonly assignment_kinds: Set<ts.SyntaxKind>;
	private readonly object_aliases: TypeScriptExpressionAliases;
	private readonly reflect_aliases: TypeScriptExpressionAliases;
	private readonly static_expression_values: TypeScriptStaticExpressionValues;
	private readonly proxy_expressions: TypeScriptProxyExpressionsContract;
	private readonly alias_analysis: PrototypeAliasAnalysis;

	/** Responsibilities: _prototype member target_. **/
	private prototype_member_target(node: ts.Expression): boolean {
		if (!ts.isPropertyAccessExpression(node) && !ts.isElementAccessExpression(node)) {
			return false;
		}
		return this.proxy_expressions.contains_property(node, TYPESCRIPT_PROTOTYPE_NAME);
	}

	/** Responsibilities: _prototype API member name_. **/
	private accessed_name(expression: ts.Expression, node: ts.Node): string {
		if (ts.isPropertyAccessExpression(expression)) {
			return expression.name.text;
		}
		if (!ts.isElementAccessExpression(expression)) {
			return "";
		}
		const argument = expression.argumentExpression;
		if (argument === undefined) {
			return "";
		}
		return this.static_expression_values.value(argument, node);
	}

	/** Responsibilities: _prototype mutations_. **/
	private prototype_call(node: ts.Node): boolean {
		if (!ts.isCallExpression(node)) {
			return false;
		}
		if (!ts.isPropertyAccessExpression(node.expression) && !ts.isElementAccessExpression(node.expression)) {
			return false;
		}
		if (this.accessed_name(node.expression, node) !== "setPrototypeOf") {
			return false;
		}
		if (this.object_aliases.receiver(node.expression.expression, node)) {
			return true;
		}
		return this.reflect_aliases.receiver(node.expression.expression, node);
	}

	/** Responsibilities: _prototype assignment target_. **/
	private prototype_assignment_target(node: ts.BinaryExpression): boolean {
		if (this.prototype_member_target(node.left)) {
			return true;
		}
		const left_chain = this.proxy_expressions.property_chain(node.left);
		if (left_chain.length < 2) {
			return false;
		}
		return this.alias_analysis.target(node, left_chain, this.proxy_expressions);
	}

	/** Responsibilities: _prototype mutation dependencies_. **/
	public constructor() {
		this.assignment_kinds = new Set([
			ts.SyntaxKind.EqualsToken,
			ts.SyntaxKind.PlusEqualsToken,
			ts.SyntaxKind.MinusEqualsToken,
			ts.SyntaxKind.AsteriskEqualsToken,
			ts.SyntaxKind.SlashEqualsToken,
			ts.SyntaxKind.PercentEqualsToken,
			ts.SyntaxKind.AsteriskAsteriskEqualsToken,
			ts.SyntaxKind.LessThanLessThanEqualsToken,
			ts.SyntaxKind.GreaterThanGreaterThanEqualsToken,
			ts.SyntaxKind.GreaterThanGreaterThanGreaterThanEqualsToken,
			ts.SyntaxKind.AmpersandEqualsToken,
			ts.SyntaxKind.BarEqualsToken,
			ts.SyntaxKind.CaretEqualsToken,
		]);
		this.object_aliases = new TypeScriptExpressionAliases("Object");
		this.reflect_aliases = new TypeScriptExpressionAliases("Reflect");
		this.static_expression_values = new TypeScriptStaticExpressionValues(new TypeScriptStaticExpressionOperations());
		this.proxy_expressions = new TypeScriptProxyExpressions();
		this.alias_analysis = new PrototypeAliasAnalysis(new PrototypeAliasScope());
	}

	/** Responsibilities: _prototype assignment recognition_. **/
	public prototype_assignment(node: ts.Node): boolean {
		if (this.prototype_call(node)) {
			return true;
		}
		if (this.prototype_update(node)) {
			return true;
		}
		if (!ts.isBinaryExpression(node)) {
			return false;
		}
		if (!this.assignment_kinds.has(node.operatorToken.kind)) {
			return false;
		}
		return this.prototype_assignment_target(node);
	}

	/** Responsibilities: _prototype update recognition_. **/
	public prototype_update(node: ts.Node): boolean {
		if (!ts.isPrefixUnaryExpression(node) && !ts.isPostfixUnaryExpression(node)) {
			return false;
		}
		if (node.operator !== ts.SyntaxKind.PlusPlusToken && node.operator !== ts.SyntaxKind.MinusMinusToken) {
			return false;
		}
		return this.prototype_member_target(node.operand);
	}
}
