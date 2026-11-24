import type {
	StoredAliasDeclarationIndexContract,
	TypeScriptStoredBindAliasContract,
} from "src/parser/analysis/protocols";
import { TypeScriptStoredBindCall } from "src/parser/analysis/type_script_stored_bind_call";
import type { CallableStaticValueResolver } from "src/runtime_types";
import type { TypeScriptMemberAliasesContract } from "src/typescript_runtime_protocols";
import ts from "typescript";

/** Responsibilities: _bind alias classification_, _target member contract_. **/
export class TypeScriptStoredBindAlias implements TypeScriptStoredBindAliasContract {
	private readonly _alias_declarations: StoredAliasDeclarationIndexContract;

	/** Responsibilities: _source alias cache initialization_. **/
	public constructor(alias_declarations: StoredAliasDeclarationIndexContract) {
		this._alias_declarations = alias_declarations;
	}

	/** Responsibilities: _bind target boundary_. **/
	public target_member(expression: ts.Expression, node: ts.CallExpression): boolean {
		if (!ts.isPropertyAccessExpression(expression)) {
			return false;
		}
		if (expression.name.text !== "bind" || node.arguments.length === 0) {
			return false;
		}
		for (const context of node.arguments) {
			return !ts.isObjectLiteralExpression(context) && !ts.isArrayLiteralExpression(context);
		}
		return false;
	}

	/** Responsibilities: _bind invocation classification_. **/
	public matches(
		node: ts.Node,
		expression: ts.Expression,
		member_aliases: TypeScriptMemberAliasesContract,
		static_value: CallableStaticValueResolver,
	): boolean {
		if (!ts.isCallExpression(node)) {
			return false;
		}
		const invocation = new TypeScriptStoredBindCall({
			node,
			expression,
			member_aliases,
			static_value,
			alias_declarations: this._alias_declarations,
		});
		return invocation.matches();
	}
}
