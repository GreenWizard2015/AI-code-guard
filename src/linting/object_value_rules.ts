import ts from "typescript";
import { TypeScriptExpressionAliases } from "src/typescript-aliases/type_script_expression_aliases";
import { TypeScriptMemberAliases } from "src/typescript-aliases/type_script_member_aliases";
import { TypeScriptStaticExpressionValues } from "src/typescript-aliases/callables/type_script_static_expression_values";
import { TypeScriptStaticExpressionOperations } from "src/typescript-aliases/callables/type_script_static_expression_operations";
import { DynamicObjectMemberAliases } from "src/typescript-aliases/dynamic_object_member_aliases";
import type {
	DynamicObjectMemberAliasesContract,
	ObjectValueRulesContract,
	TypeScriptMemberAliasesContract,
} from "src/protocols";
import { TYPESCRIPT_PROTOTYPE_NAME } from "src/constants";

/** Responsibilities: _object alias resolution_, _object value diagnostics_. **/
export class ObjectValueRules implements ObjectValueRulesContract {
	private readonly object_aliases: TypeScriptExpressionAliases;
	private readonly nested_object_aliases: DynamicObjectMemberAliasesContract;
	private readonly static_expression_values: TypeScriptStaticExpressionValues;
	private readonly object_member_aliases: TypeScriptMemberAliasesContract;
	private readonly prototype_name = TYPESCRIPT_PROTOTYPE_NAME;
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
		expression = this.object_aliases.unwrapped(expression);
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
		expression = this.object_aliases.unwrapped(expression);
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
		node = this.object_aliases.unwrapped(node);
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

	/** Responsibilities: _Object assign member classification_. **/
	private object_assign_member(expression: ts.Expression, node: ts.Node): boolean {
		if (this.nested_object_aliases.member(expression, node, "assign")) {
			return true;
		}
		if (!ts.isPropertyAccessExpression(expression) && !ts.isElementAccessExpression(expression)) {
			return false;
		}
		const target = expression.expression;
		if (this.member_name(expression, node) !== "assign") {
			return false;
		}
		return this.object_receiver(target, node);
	}

	/** Responsibilities: _forwarded Object.assign invocation_. **/
	private forwarded_object_assign(expression: ts.Expression, node: ts.Node): boolean {
		if (!ts.isPropertyAccessExpression(expression)) {
			return false;
		}
		if (expression.name.text !== "call" && expression.name.text !== "apply") {
			return false;
		}
		if (!ts.isIdentifier(expression.expression)) {
			return false;
		}
		return this.object_member_aliases.property(expression.expression, node, "assign");
	}

	/** Responsibilities: _object value composition_. **/
	public constructor() {
		this.object_aliases = new TypeScriptExpressionAliases("Object");
		this.static_expression_values = new TypeScriptStaticExpressionValues(new TypeScriptStaticExpressionOperations());
		this.object_member_aliases = new TypeScriptMemberAliases("Object", (expression, node) =>
			this.static_expression_values.value(expression, node),
		);
		this.nested_object_aliases = new DynamicObjectMemberAliases("Object");
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
		const expression = this.object_aliases.unwrapped(node.expression);
		if (this.forwarded_object_assign(expression, node)) {
			return true;
		}
		if (ts.isIdentifier(expression)) {
			return this.object_member_aliases.property(expression, node, "assign");
		}
		return this.object_assign_member(expression, node);
	}

	/** Responsibilities: _reporting object method operations_. **/
	public object_method(node: ts.Node): boolean {
		if (!ts.isCallExpression(node)) {
			return false;
		}
		const expression = this.object_aliases.unwrapped(node.expression);
		if (ts.isIdentifier(expression)) {
			return this.object_member_aliases.property(expression, node, "hasOwnProperty");
		}
		if (!ts.isPropertyAccessExpression(expression) && !ts.isElementAccessExpression(expression)) {
			return false;
		}
		if (this.member_name(expression, node) !== this.call_name) {
			return false;
		}
		return this.object_chain(expression.expression, node);
	}
}
