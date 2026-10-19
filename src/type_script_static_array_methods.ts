import ts from "typescript";
import { TypeScriptExpressionAliases } from "src/typescript-aliases/type_script_expression_aliases";
import { TypeScriptMemberAliases } from "src/typescript-aliases/type_script_member_aliases";
import type { StaticArrayMethodsContract, TypeScriptMemberAliasesContract } from "src/protocols";

/** Responsibilities: _array factory recognition_, _array source extraction_. **/
export class TypeScriptStaticArrayMethods implements StaticArrayMethodsContract {
	private readonly array_aliases: TypeScriptExpressionAliases;
	private readonly array_member_aliases: TypeScriptMemberAliasesContract;

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

	/** Responsibilities: _array argument accumulation_. **/
	private append_call(values: ts.Expression[], expression: ts.CallExpression): boolean {
		if (!this.matches_array_of(expression) && !this.matches_array_constructor(expression)) {
			return false;
		}
		for (const argument of expression.arguments) {
			values.push(argument);
		}
		return true;
	}

	/** Responsibilities: _Array construction arguments_. **/
	private append_construction(values: ts.Expression[], expression: ts.NewExpression): boolean {
		if (!this.matches_new_array(expression)) {
			return false;
		}
		const arguments_list = expression.arguments;
		if (arguments_list !== undefined) {
			for (const argument of arguments_list) {
				values.push(argument);
			}
		}
		return true;
	}

	/** Responsibilities: _field initialization_. **/
	constructor() {
		this.array_aliases = new TypeScriptExpressionAliases("Array");
		this.array_member_aliases = new TypeScriptMemberAliases("Array", () => "");
	}

	/** Responsibilities: _Array.of invocation classification_. **/
	public matches_array_of(expression: ts.CallExpression): boolean {
		return this.matches_array_method(expression, "of");
	}

	/** Responsibilities: _Array.from invocation classification_. **/
	public matches_array_from(expression: ts.CallExpression): boolean {
		return this.matches_array_method(expression, "from");
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
			return this.append_call(values, expression);
		}
		if (!ts.isNewExpression(expression)) {
			return false;
		}
		return this.append_construction(values, expression);
	}
}
