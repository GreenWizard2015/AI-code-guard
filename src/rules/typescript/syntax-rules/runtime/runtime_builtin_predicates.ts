import { TYPESCRIPT_PROTOTYPE_NAME } from "src/constants";
import { TypeScriptExpressionAliases } from "src/parser/typescript-aliases/type_script_expression_aliases";
import { TypeScriptStaticExpressionOperations } from "src/parser/typescript-aliases/type_script_static_expression_operations";
import { TypeScriptStaticExpressionValues } from "src/parser/typescript-aliases/type_script_static_expression_values";
import { TypeScriptProxyExpressions } from "src/rules/typescript/syntax-rules/callables/type_script_proxy_expressions";
import { RuntimeAliasScope } from "src/rules/typescript/syntax-rules/runtime/runtime_alias_scope";
import { RuntimeBuiltinAliasAnalysis } from "src/rules/typescript/syntax-rules/runtime/runtime_builtin_alias_analysis";
import type { StaticExpressionValuesContract } from "src/shared_services_protocols";
import type { TypeScriptProxyExpressionsContract } from "src/typescript_analysis_protocols";
import type { TypeScriptObjectAliasDeclarationIndexContract } from "src/typescript_runtime_protocols";
import type { TypeScriptExpressionAliasesContract } from "src/typescript_runtime_protocols";
import type { TypeScriptBuiltinMutationContract } from "src/typescript_runtime_protocols";
import ts from "typescript";

/** Responsibilities: _prototype mutation recognition_, _prototype alias analysis_. **/
export class RuntimeBuiltinPredicates implements TypeScriptBuiltinMutationContract {
	private readonly _assignment_kinds: Set<ts.SyntaxKind>;
	private readonly _object_aliases: TypeScriptExpressionAliasesContract;
	private readonly _reflect_aliases: TypeScriptExpressionAliasesContract;
	private readonly _static_expression_values: StaticExpressionValuesContract;
	private readonly _proxy_expressions: TypeScriptProxyExpressionsContract;
	private readonly _alias_analysis: RuntimeBuiltinAliasAnalysis;

	/** Responsibilities: _prototype member target_. **/
	private prototype_member_target(member_access: ts.Expression): boolean {
		if (!ts.isPropertyAccessExpression(member_access) && !ts.isElementAccessExpression(member_access)) {
			return false;
		}
		return this._proxy_expressions.contains_property(member_access, TYPESCRIPT_PROTOTYPE_NAME);
	}

	/** Responsibilities: _prototype API member name_. **/
	private accessed_name(member_access: ts.Expression, access_owner: ts.Node): string {
		if (ts.isPropertyAccessExpression(member_access)) {
			return member_access.name.text;
		}
		if (!ts.isElementAccessExpression(member_access)) {
			return "";
		}
		const argument = member_access.argumentExpression;
		if (argument === undefined) {
			return "";
		}
		return this._static_expression_values.value(argument, access_owner);
	}

	/** Responsibilities: _prototype mutations_. **/
	private prototype_call(call_expression: ts.CallExpression): boolean {
		if (ts.isPropertyAccessExpression(call_expression.expression)) {
			return this.prototype_method_call(call_expression);
		}
		if (!ts.isElementAccessExpression(call_expression.expression)) {
			return false;
		}
		return this.prototype_method_call(call_expression);
	}

	/** Responsibilities: _prototype method call_. **/
	private prototype_method_call(call_expression: ts.CallExpression): boolean {
		const member_access = call_expression.expression;
		if (!ts.isPropertyAccessExpression(member_access) && !ts.isElementAccessExpression(member_access)) {
			return false;
		}
		if (this.accessed_name(member_access, call_expression) !== "setPrototypeOf") {
			return false;
		}
		if (this._object_aliases.receiver({ expression: member_access.expression, node: call_expression })) {
			return true;
		}
		return this._reflect_aliases.receiver({ expression: member_access.expression, node: call_expression });
	}

	/** Responsibilities: _prototype assignment target_. **/
	private prototype_assignment_target(assignment: ts.BinaryExpression): boolean {
		if (this.prototype_member_target(assignment.left)) {
			return true;
		}
		const left_chain = this._proxy_expressions.property_chain(assignment.left);
		if (left_chain.length < 2) {
			return false;
		}
		return this._alias_analysis.target(assignment, left_chain);
	}

	/** Responsibilities: _prototype increment target_. **/
	private increment_or_decrement(operator: ts.SyntaxKind, operand: ts.Expression): boolean {
		if (operator === ts.SyntaxKind.PlusPlusToken) {
			return this.prototype_member_target(operand);
		}
		if (operator !== ts.SyntaxKind.MinusMinusToken) {
			return false;
		}
		return this.prototype_member_target(operand);
	}

	/** Responsibilities: _prototype mutation dependencies_. **/
	public constructor(declaration_index: TypeScriptObjectAliasDeclarationIndexContract) {
		this._assignment_kinds = new Set([
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
		this._object_aliases = new TypeScriptExpressionAliases("Object", declaration_index);
		this._reflect_aliases = new TypeScriptExpressionAliases("Reflect", declaration_index);
		this._static_expression_values = new TypeScriptStaticExpressionValues(new TypeScriptStaticExpressionOperations());
		this._proxy_expressions = new TypeScriptProxyExpressions();
		this._alias_analysis = new RuntimeBuiltinAliasAnalysis(new RuntimeAliasScope(), this._proxy_expressions);
	}

	/** Responsibilities: _prototype assignment recognition_. **/
	public prototype_assignment(candidate: ts.Node): boolean {
		if (ts.isCallExpression(candidate) && this.prototype_call(candidate)) {
			return true;
		}
		if (this.prototype_update(candidate)) {
			return true;
		}
		if (!ts.isBinaryExpression(candidate)) {
			return false;
		}
		if (!this._assignment_kinds.has(candidate.operatorToken.kind)) {
			return false;
		}
		return this.prototype_assignment_target(candidate);
	}

	/** Responsibilities: _prototype update recognition_. **/
	public prototype_update(candidate: ts.Node): boolean {
		if (ts.isPrefixUnaryExpression(candidate)) {
			return this.increment_or_decrement(candidate.operator, candidate.operand);
		}
		if (!ts.isPostfixUnaryExpression(candidate)) {
			return false;
		}
		return this.increment_or_decrement(candidate.operator, candidate.operand);
	}
}
