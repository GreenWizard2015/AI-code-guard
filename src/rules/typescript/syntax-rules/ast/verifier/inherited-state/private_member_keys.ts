import { TypeScriptStaticArrayKeys } from "src/parser/typescript-aliases/callables/static-array/type_script_static_array_keys";
import { TypeScriptObjectAliasDeclarationIndex } from "src/parser/typescript-aliases/type_script_object_alias_declaration_index";
import { TypeScriptStaticExpressionValues } from "src/parser/typescript-aliases/type_script_static_expression_values";
import { TypeScriptStaticKeyAliases } from "src/parser/typescript-aliases/type_script_static_key_aliases";
import type { StaticExpressionValuesContract } from "src/shared_services_protocols";
import type { PrivateMemberKeysContract, StaticExpressionOperationsContract } from "src/shared_services_protocols";
import type {
	TypeScriptStaticArrayKeysContract,
	TypeScriptStaticKeyAliasesContract,
} from "src/typescript_runtime_protocols";
import ts from "typescript";

/** Responsibilities: _literal member resolution_, _aliased key resolution_. **/
export class PrivateMemberKeys implements PrivateMemberKeysContract {
	private readonly _static_expression_values: StaticExpressionValuesContract;
	private readonly _static_key_aliases: TypeScriptStaticKeyAliasesContract;
	private readonly _static_array_keys: TypeScriptStaticArrayKeysContract;

	/** Responsibilities: _private key unwrapping_. **/
	private unwrapped_key(expression: ts.Expression): ts.Expression {
		let current = expression;
		while (true) {
			if (ts.isParenthesizedExpression(current)) {
				current = current.expression;
				continue;
			}
			if (ts.isNonNullExpression(current) || ts.isAsExpression(current) || ts.isTypeAssertionExpression(current)) {
				current = current.expression;
				continue;
			}
			if (ts.isSatisfiesExpression(current)) {
				current = current.expression;
				continue;
			}
			return current;
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
		const scalar_key = this._static_expression_values.value(key, access);
		if (scalar_key !== "") {
			return scalar_key;
		}
		return this._static_key_aliases.object_property(key, access);
	}

	/** Responsibilities: _class member name resolution_. **/
	/** Responsibilities: _static key dependency initialization_. **/
	public constructor(static_expression_operations: StaticExpressionOperationsContract) {
		this._static_expression_values = new TypeScriptStaticExpressionValues(static_expression_operations);
		this._static_array_keys = new TypeScriptStaticArrayKeys(new TypeScriptObjectAliasDeclarationIndex());
		this._static_key_aliases = new TypeScriptStaticKeyAliases();
	}

	/** Responsibilities: _private member name resolution_. **/
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
		return this._static_array_keys.value(key, access.getSourceFile());
	}
}
