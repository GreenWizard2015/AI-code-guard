import ts from 'typescript';
import { TypeScriptExpressionAliases } from 'src/typescript-aliases/typescript-expression-aliases';
import { TypeScriptMemberAliases } from 'src/typescript-aliases/typescript-member-aliases';

/** Responsibilities: _static Array method sources_. **/
export class TypeScriptStaticArrayMethods {
	private readonly array_aliases = new TypeScriptExpressionAliases('Array');
	private readonly array_member_aliases = new TypeScriptMemberAliases('Array', () => '');

	/** Responsibilities: _Array method invocation classification_. **/
	private matches_array_method(expression: ts.CallExpression, name: string): boolean {
		if (ts.isIdentifier(expression.expression)) {
			return this.array_member_aliases.property(expression.expression, expression, name);
		}
		const member = expression.expression;
		if (!ts.isPropertyAccessExpression(member) && !ts.isElementAccessExpression(member)) {
			return false;
		}
		if (this.array_aliases.member_name(member) !== name) {
			return false;
		}
		return this.array_aliases.receiver(member.expression, expression);
	}

	/** Responsibilities: _Array.of invocation classification_. **/
	public matches_array_of(expression: ts.CallExpression): boolean {
		return this.matches_array_method(expression, 'of');
	}

	/** Responsibilities: _Array.from invocation classification_. **/
	public matches_array_from(expression: ts.CallExpression): boolean {
		return this.matches_array_method(expression, 'from');
	}

	/** Responsibilities: _Array constructor invocation classification_. **/
	public matches_array_constructor(expression: ts.CallExpression): boolean {
		return this.array_aliases.receiver(expression.expression, expression);
	}

	/** Responsibilities: _new Array invocation classification_. **/
	public matches_new_array(expression: ts.NewExpression): boolean {
		return this.array_aliases.receiver(expression.expression, expression);
	}

	/** Responsibilities: _Array.of source collection_. **/
	public append(values: ts.Expression[], expression: ts.Expression): boolean {
		if (ts.isCallExpression(expression)) {
			if (!this.matches_array_of(expression) && !this.matches_array_constructor(expression)) {
				return false;
			}
			values.push(...expression.arguments);
			return true;
		}
		if (!ts.isNewExpression(expression) || !this.matches_new_array(expression)) {
			return false;
		}
		if (expression.arguments === undefined) {
			return true;
		}
		values.push(...expression.arguments);
		return true;
	}
}
