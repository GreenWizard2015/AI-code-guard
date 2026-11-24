import type { TypeScriptExpressionNormalizerContract } from "src/typescript_runtime_protocols";
import type { TypeScriptObjectAliasDeclarationIndexContract } from "src/typescript_runtime_protocols";
import ts from "typescript";

/** Responsibilities: _expression target identity_, _transparent expression normalization_. **/
export class TypeScriptExpressionTarget implements TypeScriptExpressionNormalizerContract {
	private readonly _target_name: string;
	private readonly _declaration_index: TypeScriptObjectAliasDeclarationIndexContract;

	/** Responsibilities: _assertion wrapper removal_. **/
	private assertion_child(assertion_expression: ts.Expression): ts.Expression {
		if (ts.isAssertionExpression(assertion_expression) || ts.isSatisfiesExpression(assertion_expression)) {
			return assertion_expression.expression;
		}
		return assertion_expression;
	}

	/** Responsibilities: _runtime wrapper removal_. **/
	private runtime_child(runtime_expression: ts.Expression): ts.Expression {
		if (ts.isAwaitExpression(runtime_expression)) {
			return runtime_expression.expression;
		}
		if (ts.isParenthesizedExpression(runtime_expression)) {
			return runtime_expression.expression;
		}
		if (ts.isNonNullExpression(runtime_expression)) {
			return runtime_expression.expression;
		}
		return runtime_expression;
	}

	/** Responsibilities: _transparent expression normalization_. **/
	private transparent_child(wrapped_expression: ts.Expression): ts.Expression {
		const assertion = this.assertion_child(wrapped_expression);
		if (assertion !== wrapped_expression) {
			return assertion;
		}
		return this.runtime_child(wrapped_expression);
	}

	/** Responsibilities: _member path parent resolution_. **/
	private member_parent(member_expression: ts.Expression): ts.Expression {
		if (ts.isPropertyAccessExpression(member_expression)) {
			return this._declaration_index.normalize_expression(member_expression.expression, this);
		}
		if (ts.isElementAccessExpression(member_expression)) {
			return this._declaration_index.normalize_expression(member_expression.expression, this);
		}
		return member_expression;
	}

	/** Responsibilities: _dotted target path recognition_. **/
	private matches_member_path(path_expression: ts.Expression): boolean {
		const segments = this._target_name.split(".");
		if (segments.includes("")) {
			return false;
		}
		let current = this._declaration_index.normalize_expression(path_expression, this);
		for (let index = segments.length - 1; index > 0; index -= 1) {
			if (this.member_name(current) !== segments[index]) {
				return false;
			}
			current = this.member_parent(current);
		}
		return ts.isIdentifier(current) && current.text === segments[0];
	}

	/** Responsibilities: _static expression member name_. **/
	private member_name(member_expression: ts.Expression): string {
		if (ts.isPropertyAccessExpression(member_expression)) {
			return member_expression.name.text;
		}
		if (!ts.isElementAccessExpression(member_expression) || member_expression.argumentExpression === undefined) {
			return "";
		}
		const key = this._declaration_index.normalize_expression(member_expression.argumentExpression, this);
		if (ts.isStringLiteral(key) || ts.isNoSubstitutionTemplateLiteral(key)) {
			return key.text;
		}
		return "";
	}

	/** Responsibilities: _expression target initialization_. **/
	public constructor(target_name: string, declaration_index: TypeScriptObjectAliasDeclarationIndexContract) {
		this._target_name = target_name;
		this._declaration_index = declaration_index;
	}

	/** Responsibilities: _transparent wrapper traversal_. **/
	public normalize_uncached(expression: ts.Expression): ts.Expression {
		let current = expression;
		let child = this.transparent_child(current);
		while (child !== current) {
			current = child;
			child = this.transparent_child(current);
		}
		return current;
	}

	/** Responsibilities: _target identity matching_. **/
	public matches(candidate_expression: ts.Expression): boolean {
		if (this._target_name === "*") {
			return true;
		}
		if (this._target_name === "this") {
			return candidate_expression.kind === ts.SyntaxKind.ThisKeyword;
		}
		if (this._target_name.includes(".")) {
			return this.matches_member_path(candidate_expression);
		}
		return ts.isIdentifier(candidate_expression) && candidate_expression.text === this._target_name;
	}
}
