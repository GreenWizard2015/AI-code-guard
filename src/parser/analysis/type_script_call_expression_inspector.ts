import type { TypeScriptStoredBindAliasContract } from "src/parser/analysis/protocols";
import { TypeScriptStoredAliasDeclarationIndex } from "src/parser/analysis/type_script_stored_alias_declaration_index";
import { TypeScriptStoredBindAlias } from "src/parser/analysis/type_script_stored_bind_alias";
import { TypeScriptExpressionAliases } from "src/parser/typescript-aliases/type_script_expression_aliases";
import { TypeScriptMemberAliases } from "src/parser/typescript-aliases/type_script_member_aliases";
import { TypeScriptStaticExpressionOperations } from "src/parser/typescript-aliases/type_script_static_expression_operations";
import { TypeScriptStaticExpressionValues } from "src/parser/typescript-aliases/type_script_static_expression_values";
import type { StaticExpressionValuesContract } from "src/shared_services_protocols";
import type { TypeScriptCallExpressionInspectorContract } from "src/typescript_analysis_protocols";
import type { TypeScriptMemberAliasesContract } from "src/typescript_runtime_protocols";
import type {
	TypeScriptExpressionAliasesContract,
	TypeScriptObjectAliasDeclarationIndexContract,
} from "src/typescript_runtime_protocols";
import ts from "typescript";

/** Responsibilities: _expression shapes_, _invocation targets_. **/
export class TypeScriptCallExpressionInspector implements TypeScriptCallExpressionInspectorContract {
	private readonly _expression_aliases: TypeScriptExpressionAliasesContract;
	private readonly _stored_bind_aliases: TypeScriptStoredBindAliasContract;
	private readonly _static_expression_values: StaticExpressionValuesContract;
	private readonly _member_aliases: TypeScriptMemberAliasesContract;
	private readonly _empty_expressions: readonly ts.Expression[];

	/** Responsibilities: _bind context unwrapping_. **/
	private unwrap_context(expression: ts.Expression): ts.Expression {
		let current = expression;
		while (ts.isSatisfiesExpression(current)) {
			current = current.expression;
		}
		return current;
	}

	/** Responsibilities: _bind source resolution_. **/
	private bind_source(expression: ts.Expression): ts.Expression[] {
		const current = this._expression_aliases.unwrapped(expression);
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
		const argument = node.arguments.at(0);
		if (argument === undefined) {
			return false;
		}
		const context = this.unwrap_context(argument);
		return !ts.isObjectLiteralExpression(context) && !ts.isArrayLiteralExpression(context);
	}

	/** Responsibilities: _resolution direct values declared_. **/
	private declaration_value(declaration: ts.VariableDeclaration): readonly ts.Expression[] {
		if (declaration.initializer !== undefined) {
			return [declaration.initializer];
		}
		return this._empty_expressions;
	}

	/** Responsibilities: _resolution expressions output output_. **/
	private return_value(node: ts.ReturnStatement): readonly ts.Expression[] {
		if (node.expression !== undefined) {
			return [node.expression];
		}
		return this._empty_expressions;
	}

	/** Responsibilities: _field initialization_. **/
	public constructor(declaration_index: TypeScriptObjectAliasDeclarationIndexContract) {
		this._empty_expressions = [];
		this._expression_aliases = new TypeScriptExpressionAliases("", declaration_index);
		this._stored_bind_aliases = new TypeScriptStoredBindAlias(new TypeScriptStoredAliasDeclarationIndex());
		this._static_expression_values = new TypeScriptStaticExpressionValues(new TypeScriptStaticExpressionOperations());
		this._member_aliases = new TypeScriptMemberAliases(
			"*",
			(expression, node) => this._static_expression_values.value(expression, node),
			declaration_index,
		);
	}

	/** Responsibilities: _collection direct value expressions_. **/
	public direct_value_expression(value_site: ts.Node): readonly ts.Expression[] {
		if (ts.isPropertyAssignment(value_site)) {
			return [value_site.initializer];
		}
		if (ts.isVariableDeclaration(value_site)) {
			return this.declaration_value(value_site);
		}
		if (ts.isParameter(value_site) && value_site.initializer !== undefined) {
			return [value_site.initializer];
		}
		if (ts.isReturnStatement(value_site)) {
			return this.return_value(value_site);
		}
		if (ts.isBinaryExpression(value_site)) {
			return [value_site.right];
		}
		return this._empty_expressions;
	}

	/** Responsibilities: _bind usage classification_. **/
	public bind_call(call_candidate: ts.Node): boolean {
		if (!ts.isCallExpression(call_candidate)) {
			return false;
		}
		const expression = this._expression_aliases.unwrapped(call_candidate.expression);
		return this._stored_bind_aliases.matches(
			call_candidate,
			expression,
			this._member_aliases,
			(expression_value, source_node) => this._static_expression_values.value(expression_value, source_node),
		);
	}

	/** Responsibilities: _resolution target callable expression_. **/
	public bind_target(node: ts.CallExpression): ts.Expression[] {
		const expression = node.expression;
		if (!this._stored_bind_aliases.target_member(expression, node)) {
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
