import { TypeScriptProxyExpressions } from "src/rules/typescript/syntax-rules/callables/type_script_proxy_expressions";
import { TypeScriptExpressionAliases } from "src/typescript-aliases/type_script_expression_aliases";
import { TypeScriptStaticExpressionOperations } from "src/typescript-aliases/callables/type_script_static_expression_operations";
import { TypeScriptStaticExpressionValues } from "src/typescript-aliases/callables/type_script_static_expression_values";
import ts from "typescript";
import type { TypeScriptProxyExpressionsContract } from "src/protocols";
import { TYPESCRIPT_PROTOTYPE_NAME } from "src/constants";

/** Responsibilities: _prototype mutation recognition_, _prototype alias target resolution_. **/
export class PrototypePredicates {
	private readonly assignment_kinds: Set<ts.SyntaxKind>;
	private readonly object_aliases: TypeScriptExpressionAliases;
	private readonly reflect_aliases: TypeScriptExpressionAliases;
	private readonly static_expression_values: TypeScriptStaticExpressionValues;

	/** Responsibilities: _prototype member target_. **/
	private prototype_member_target(node: ts.Expression, proxy_expressions: TypeScriptProxyExpressionsContract): boolean {
		if (!ts.isPropertyAccessExpression(node) && !ts.isElementAccessExpression(node)) {
			return false;
		}
		return proxy_expressions.contains_property(node, TYPESCRIPT_PROTOTYPE_NAME);
	}

	/** Responsibilities: _prototype alias target_. **/
	private prototype_alias_target(
		node: ts.Node,
		left_chain: readonly string[],
		proxy_expressions: TypeScriptProxyExpressionsContract,
	): boolean {
		const aliases = new Set<string>();
		const visit = (child: ts.Node): void => {
			if (ts.isVariableDeclaration(child) && ts.isIdentifier(child.name)) {
				const declaration_list = child.parent;
				if (!ts.isVariableDeclarationList(declaration_list)) {
					child.forEachChild(visit);
					return;
				}
				if ((declaration_list.flags & ts.NodeFlags.Const) === 0) {
					child.forEachChild(visit);
					return;
				}
				const initializer = child.initializer;
				if (initializer === undefined) {
					child.forEachChild(visit);
					return;
				}
				if (proxy_expressions.contains_property(initializer, TYPESCRIPT_PROTOTYPE_NAME)) {
					aliases.add(child.name.text);
				}
			}
			ts.forEachChild(child, visit);
		};
		visit(node.getSourceFile());
		return left_chain.some((name) => aliases.has(name));
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

	/** Responsibilities: _prototype mutation_. **/
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
		const proxy_expressions = new TypeScriptProxyExpressions();
		if (this.prototype_member_target(node.left, proxy_expressions)) {
			return true;
		}
		const left_chain = proxy_expressions.property_chain(node.left);
		return this.prototype_alias_target(node, left_chain, proxy_expressions);
	}

	/** Responsibilities: _prototype assignment_. **/
	/** Responsibilities: _field initialization_. **/
	constructor() {
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
	}
	/** Responsibilities: _public operation_. **/
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

	/** Responsibilities: _prototype update_. **/
	public prototype_update(node: ts.Node): boolean {
		if (!ts.isPrefixUnaryExpression(node) && !ts.isPostfixUnaryExpression(node)) {
			return false;
		}
		if (node.operator !== ts.SyntaxKind.PlusPlusToken && node.operator !== ts.SyntaxKind.MinusMinusToken) {
			return false;
		}
		return this.prototype_member_target(node.operand, new TypeScriptProxyExpressions());
	}
}
