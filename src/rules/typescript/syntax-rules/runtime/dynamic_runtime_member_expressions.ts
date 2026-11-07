import { TypeScriptStaticExpressionOperations } from "src/parser/typescript-aliases/type_script_static_expression_operations";
import { TypeScriptStaticExpressionValues } from "src/parser/typescript-aliases/type_script_static_expression_values";
import type { StaticExpressionValuesContract } from "src/shared_services_protocols";
import ts from "typescript";

/** Responsibilities: _dynamic member name resolution_, _dynamic member owner extraction_. **/
export class DynamicRuntimeMemberExpressions {
	private readonly _static_expression_values: StaticExpressionValuesContract;

	/** Responsibilities: _runtime owner name_. **/
	/** Responsibilities: _static element member_. **/
	private static_element_member(element_access: ts.Expression): boolean {
		if (!ts.isElementAccessExpression(element_access)) {
			return false;
		}
		const argument = element_access.argumentExpression;
		if (argument === undefined) {
			return false;
		}
		return this._static_expression_values.value(argument, element_access).length > 0;
	}

	/** Responsibilities: _runtime member name_. **/
	/** Responsibilities: _field initialization_. **/
	public constructor() {
		this._static_expression_values = new TypeScriptStaticExpressionValues(new TypeScriptStaticExpressionOperations());
	}
	/** Responsibilities: _public operation_. **/
	public member_name(member_expression: ts.Expression): string {
		if (ts.isIdentifier(member_expression)) {
			return member_expression.text;
		}
		if (!ts.isPropertyAccessExpression(member_expression)) {
			return "";
		}
		if (!ts.isIdentifier(member_expression.expression)) {
			return "";
		}
		return member_expression.name.text;
	}

	/** Responsibilities: _dynamic member owners_. **/
	public member_owners(member_expression: ts.Expression): readonly ts.Expression[] {
		if (ts.isPropertyAccessExpression(member_expression)) {
			return [member_expression.expression];
		}
		if (ts.isElementAccessExpression(member_expression) && this.static_element_member(member_expression)) {
			return [member_expression.expression];
		}
		return [];
	}
}
