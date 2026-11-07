import { TypeScriptMemberAliases } from "src/parser/typescript-aliases/type_script_member_aliases";
import {
	EMPTY_PATCH_METHODS,
	PATCH_METHODS,
} from "src/rules/typescript/syntax-rules/runtime/runtime-patching/constants";
import type { RuntimePatchFrameworkAliasesContract } from "src/rules/typescript/syntax-rules/runtime/runtime-patching/types";
import type { TypeScriptMemberAliasesContract } from "src/typescript_runtime_protocols";
import type { TypeScriptObjectAliasDeclarationIndexContract } from "src/typescript_runtime_protocols";
import ts from "typescript";

/** Responsibilities: _framework API aliases_, _framework patch method inventory_. **/
export class RuntimePatchFrameworkAliases implements RuntimePatchFrameworkAliasesContract {
	private readonly _framework: string;
	private readonly _member_index: TypeScriptMemberAliasesContract;

	/** Responsibilities: _framework resolver initialization_. **/
	public constructor(framework: string, declaration_index: TypeScriptObjectAliasDeclarationIndexContract) {
		this._framework = framework;
		this._member_index = new TypeScriptMemberAliases(framework, () => "", declaration_index);
	}

	/** Responsibilities: _framework method lookup_. **/
	public methods(): ReadonlySet<string> {
		const methods = PATCH_METHODS.get(this._framework);
		if (methods === undefined) {
			return EMPTY_PATCH_METHODS;
		}
		return methods;
	}

	/** Responsibilities: _framework import alias resolution_. **/
	public expression_matches(expression: ts.Expression, node: ts.Node): boolean {
		if (ts.isIdentifier(expression) && expression.text === this._framework) {
			return true;
		}
		return this._member_index.member({ expression, node });
	}
}
