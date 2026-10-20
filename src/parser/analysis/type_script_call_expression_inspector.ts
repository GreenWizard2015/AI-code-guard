import ts from "typescript";
import type { TypeScriptCallExpressionInspectorContract } from "src/typescript_analysis_protocols";
import type { TypeScriptMemberAliasesContract } from "src/typescript_runtime_protocols";
import { TypeScriptExpressionAliases } from "src/typescript-aliases/type_script_expression_aliases";
import type { TypeScriptExpressionAliasesContract } from "src/typescript_runtime_protocols";
import { TypeScriptMemberAliases } from "src/typescript-aliases/type_script_member_aliases";
import { TypeScriptStaticExpressionOperations } from "src/typescript-aliases/callables/type_script_static_expression_operations";
import { TypeScriptStaticExpressionValues } from "src/typescript-aliases/callables/type_script_static_expression_values";
import { TypeScriptStoredBindAlias } from "src/parser/analysis/type_script_stored_bind_alias";

/** Responsibilities: _expression shapes_, _invocation targets_. **/
export class TypeScriptCallExpressionInspector implements TypeScriptCallExpressionInspectorContract {
	private readonly expression_aliases: TypeScriptExpressionAliasesContract;
	private readonly stored_bind_aliases: TypeScriptStoredBindAlias;
	private readonly static_expression_values: TypeScriptStaticExpressionValues;
	private readonly member_aliases: TypeScriptMemberAliasesContract;
	private readonly empty_expressions: readonly ts.Expression[] = [];

	/** Responsibilities: _bind context unwrapping_. **/
	private unwrap_context(expression: ts.Expression): ts.Expression {
		let current = expression;
		while (ts.isSatisfiesExpression(current)) {
			current = current.expression;
		}
		return current;
	}

	/** Responsibilities: _bind source resolution_. **/
	private bind_source(expression: ts.Expression): ts.Node[] {
		const current = this.expression_aliases.unwrapped(expression);
		if (ts.isIdentifier(current) || ts.isPropertyAccessExpression(current)) {
			return [current];
		}
		if (!ts.isElementAccessExpression(current)) {
			return [];
		}
		const argument = current.argumentExpression;
		if (ts.isStringLiteral(argument) || ts.isNoSubstitutionTemplateLiteral(argument)) {
			return [current];
		}
		return [];
	}

	/** Responsibilities: _bind context validation_. **/
	private has_context(node: ts.CallExpression): boolean {
		if (node.arguments.length === 0) {
			return false;
		}
		const context = this.unwrap_context(node.arguments[0]);
		return !ts.isObjectLiteralExpression(context) && !ts.isArrayLiteralExpression(context);
	}

	/** Responsibilities: _resolution direct values declared_. **/
	private declaration_value(node: ts.Node): readonly ts.Expression[] {
		if (!ts.isVariableDeclaration(node) && !ts.isParameter(node)) {
			return this.empty_expressions;
		}
		if (node.initializer !== undefined) {
			return [node.initializer];
		}
		return this.empty_expressions;
	}

	/** Responsibilities: _resolution expressions output output_. **/
	private return_value(node: ts.ReturnStatement): readonly ts.Expression[] {
		if (node.expression !== undefined) {
			return [node.expression];
		}
		return this.empty_expressions;
	}

	/** Responsibilities: _field initialization_. **/
	constructor() {
		this.expression_aliases = new TypeScriptExpressionAliases("");
		this.stored_bind_aliases = new TypeScriptStoredBindAlias();
		this.static_expression_values = new TypeScriptStaticExpressionValues(new TypeScriptStaticExpressionOperations());
		this.member_aliases = new TypeScriptMemberAliases("*", (expression, node) =>
			this.static_expression_values.value(expression, node),
		);
	}

	/** Responsibilities: _collection direct value expressions_. **/
	public direct_value_expression(node: ts.Node): readonly ts.Expression[] {
		if (ts.isPropertyAssignment(node)) {
			return [node.initializer];
		}
		if (ts.isVariableDeclaration(node) || ts.isParameter(node)) {
			return this.declaration_value(node);
		}
		if (ts.isReturnStatement(node)) {
			return this.return_value(node);
		}
		if (ts.isBinaryExpression(node)) {
			return [node.right];
		}
		return this.empty_expressions;
	}

	/** Responsibilities: _bind usage classification_. **/
	public bind_call(node: ts.Node): boolean {
		if (!ts.isCallExpression(node)) {
			return false;
		}
		const expression = this.expression_aliases.unwrapped(node.expression);
		return this.stored_bind_aliases.matches(node, expression, this.member_aliases, (expression_value, source_node) =>
			this.static_expression_values.value(expression_value, source_node),
		);
	}

	/** Responsibilities: _resolution target callable expression_. **/
	public bind_target(node: ts.CallExpression): ts.Node[] {
		const expression = node.expression;
		if (!this.stored_bind_aliases.target_member(expression, node)) {
			return [];
		}
		if (!ts.isPropertyAccessExpression(expression)) {
			return [];
		}
		if (!this.has_context(node)) {
			return [];
		}
		return this.bind_source(expression.expression);
	}
}
