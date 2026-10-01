import ts from "typescript";
import { TypeScriptExpressionAliases } from "src/typescript-aliases/typescript-expression-aliases";
import { TypeScriptMemberAliases } from "src/typescript-aliases/typescript-member-aliases";
import { TypeScriptStaticExpressionValues } from "src/typescript-callable-aliases/typescript-static-expression-values";
import { DynamicObjectMemberAliases } from "src/bridge/ts/dynamic-object-member-aliases";

/** Responsibilities: _classification object string invocation_. **/
export class ObjectValueRules {
	private readonly object_aliases = new TypeScriptExpressionAliases("Object");
	private readonly nested_object_aliases = new DynamicObjectMemberAliases("Object");
	private readonly static_expression_values = new TypeScriptStaticExpressionValues();
	private readonly object_member_aliases = new TypeScriptMemberAliases("Object", (expression, node) =>
		this.static_expression_values.value(expression, node),
	);
	private readonly prototype_name = "prototype";
	private readonly call_name = "call";

	/** Responsibilities: _Object receiver resolution_. **/
	private object_receiver(expression: ts.Expression, source: ts.Node): boolean {
		if (this.object_aliases.receiver(expression, source)) {
			return true;
		}
		return this.nested_object_aliases.receiver(expression, source);
	}

	/** Responsibilities: _static member name resolution_. **/
	private member_name(expression: ts.Expression, source: ts.Node): string {
		if (ts.isPropertyAccessExpression(expression)) {
			return expression.name.text;
		}
		return this.element_member_name(expression, source);
	}

	/** Responsibilities: _object member names_. **/
	private element_member_name(expression: ts.Expression, source: ts.Node): string {
		if (!ts.isElementAccessExpression(expression)) {
			return "";
		}
		if (expression.argumentExpression === undefined) {
			return "";
		}
		return this.element_key_name(expression.argumentExpression, source);
	}

	/** Responsibilities: _object element keys_. **/
	private element_key_name(argument: ts.Expression, source: ts.Node): string {
		const key = this.object_aliases.unwrapped(argument);
		if (ts.isStringLiteral(key)) {
			return key.text;
		}
		if (ts.isNoSubstitutionTemplateLiteral(key)) {
			return key.text;
		}
		return this.static_expression_values.value(argument, source);
	}

	/** Responsibilities: _classification expression invocation object_. **/
	private object_string_call(expression: ts.Expression): boolean {
		if (this.member_name(expression, expression) !== "toString") {
			return false;
		}
		if (!ts.isPropertyAccessExpression(expression) && !ts.isElementAccessExpression(expression)) {
			return false;
		}
		return this.object_prototype(expression.expression);
	}

	/** Responsibilities: _classification expression accesses object_. **/
	private object_prototype(expression: ts.Expression): boolean {
		if (this.member_name(expression, expression) !== this.prototype_name) {
			return false;
		}
		if (!ts.isPropertyAccessExpression(expression) && !ts.isElementAccessExpression(expression)) {
			return false;
		}
		return this.object_receiver(expression.expression, expression);
	}

	/** Responsibilities: _classification expression forms disallowed_. **/
	private object_chain(node: ts.Expression, source: ts.Node): boolean {
		if (ts.isIdentifier(node)) {
			return this.object_aliases.receiver(node, source);
		}
		if (!ts.isPropertyAccessExpression(node) && !ts.isElementAccessExpression(node)) {
			return false;
		}
		if (this.member_name(node, source) === "") {
			return false;
		}
		return this.object_chain(node.expression, source);
	}

	/** Responsibilities: _reporting object string operations_. **/
	public object_string(node: ts.Node): boolean {
		if (!ts.isCallExpression(node)) {
			return false;
		}
		if (!ts.isPropertyAccessExpression(node.expression) && !ts.isElementAccessExpression(node.expression)) {
			return false;
		}
		return this.object_string_call(node.expression.expression);
	}

	/** Responsibilities: _reporting object assignment operations_. **/
	public object_assign(node: ts.Node): boolean {
		if (!ts.isCallExpression(node)) {
			return false;
		}
		if (ts.isIdentifier(node.expression)) {
			return this.object_member_aliases.property(node.expression, node, "assign");
		}
		if (!ts.isPropertyAccessExpression(node.expression) && !ts.isElementAccessExpression(node.expression)) {
			return false;
		}
		const target = node.expression.expression;
		if (this.member_name(node.expression, node) !== "assign") {
			return false;
		}
		return this.object_receiver(target, node);
	}

	/** Responsibilities: _reporting object method operations_. **/
	public object_method(node: ts.Node): boolean {
		if (!ts.isCallExpression(node)) {
			return false;
		}
		if (ts.isIdentifier(node.expression)) {
			return this.object_member_aliases.property(node.expression, node, "hasOwnProperty");
		}
		if (!ts.isPropertyAccessExpression(node.expression) && !ts.isElementAccessExpression(node.expression)) {
			return false;
		}
		if (this.member_name(node.expression, node) !== this.call_name) {
			return false;
		}
		return this.object_chain(node.expression.expression, node);
	}
}
