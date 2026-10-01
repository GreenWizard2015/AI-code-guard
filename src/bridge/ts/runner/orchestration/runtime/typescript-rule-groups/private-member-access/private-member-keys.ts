import ts from "typescript";
import { TypeScriptStaticExpressionValues } from "src/typescript-callable-aliases/typescript-static-expression-values";
import { TypeScriptStaticKeyAliases } from "src/typescript-callable-aliases/static-key-aliases";
import { TypeScriptStaticArrayKeys } from "src/typescript-callable-aliases/static-array/typescript-static-array-keys";

/** Responsibilities: _private member key resolution_. **/
export class PrivateMemberKeys {
	private readonly static_expression_values = new TypeScriptStaticExpressionValues();
	private readonly static_key_aliases = new TypeScriptStaticKeyAliases();
	private readonly static_array_keys = new TypeScriptStaticArrayKeys();

	/** Responsibilities: _transparent expression unwrapping_. **/
	private unwrap_expression(expression: ts.Expression): ts.Expression {
		if (ts.isParenthesizedExpression(expression)) {
			return expression.expression;
		}
		if (ts.isNonNullExpression(expression)) {
			return expression.expression;
		}
		if (ts.isAsExpression(expression)) {
			return expression.expression;
		}
		if (ts.isTypeAssertionExpression(expression)) {
			return expression.expression;
		}
		if (ts.isSatisfiesExpression(expression)) {
			return expression.expression;
		}
		return expression;
	}

	/** Responsibilities: _private key unwrapping_. **/
	private unwrapped_key(expression: ts.Expression): ts.Expression {
		let current = expression;
		while (true) {
			const unwrapped = this.unwrap_expression(current);
			if (unwrapped === current) {
				return current;
			}
			current = unwrapped;
		}
	}

	/** Responsibilities: _literal key resolution_. **/
	private literal_key(expression: ts.Expression): string {
		if (ts.isStringLiteral(expression)) {
			return expression.text;
		}
		if (ts.isNoSubstitutionTemplateLiteral(expression)) {
			return expression.text;
		}
		return "";
	}

	/** Responsibilities: _aliased key resolution_. **/
	private aliased_key(key: ts.Expression, access: ts.ElementAccessExpression): string {
		const scalar_key = this.static_expression_values.value(key, access);
		if (scalar_key !== "") {
			return scalar_key;
		}
		return this.static_key_aliases.object_property(key, access);
	}

	/** Responsibilities: _class member name resolution_. **/
	public member_name(member: ts.ClassElement, source_file: ts.SourceFile): string {
		if (member.name === undefined) {
			return "";
		}
		return member.name.getText(source_file);
	}

	/** Responsibilities: _element member key resolution_. **/
	public access_key(access: ts.ElementAccessExpression): string {
		const argument = access.argumentExpression;
		if (argument === undefined) {
			return "";
		}
		const key = this.unwrapped_key(argument);
		const literal = this.literal_key(key);
		if (literal !== "") {
			return literal;
		}
		const alias = this.aliased_key(key, access);
		if (alias !== "") {
			return alias;
		}
		return this.static_array_keys.value(key, access.getSourceFile());
	}
}
