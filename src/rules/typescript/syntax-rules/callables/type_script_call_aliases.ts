import type { ReadonlyStringMap } from "src/analysis_types";
import { TypeScriptCallAliasIndex } from "src/rules/typescript/syntax-rules/callables/type_script_call_alias_index";
import type { BindingAliasesContract, CallAliasesContract, ExpressionNamesContract } from "src/runtime_protocols";
import type { SourceFileReadonlyStringMapCache } from "src/source_types";
import ts from "typescript";

/** Responsibilities: _invocation aliases_, _scope-aware aliases_. **/
export class TypeScriptCallAliases implements CallAliasesContract {
	private readonly _expression_names: ExpressionNamesContract;
	private readonly _binding_aliases: BindingAliasesContract;
	private readonly _cache: SourceFileReadonlyStringMapCache;

	/** Responsibilities: _invocation alias map_. **/
	/** Responsibilities: _alias state_. **/
	public constructor(expression_names: ExpressionNamesContract, binding_aliases: BindingAliasesContract) {
		this._cache = new WeakMap<ts.SourceFile, ReadonlyStringMap>();
		this._expression_names = expression_names;
		this._binding_aliases = binding_aliases;
	}

	/** Responsibilities: _alias map_. **/
	public names(source_file: ts.SourceFile): ReadonlyMap<string, string> {
		const cached = this._cache.get(source_file);
		if (cached !== undefined) {
			return cached;
		}
		const index = new TypeScriptCallAliasIndex(this._expression_names, this._binding_aliases);
		index.collect(source_file);
		const aliases = index.names();
		this._cache.set(source_file, aliases);
		return aliases;
	}

	/** Responsibilities: _invocation names_. **/
	public call_name(call: ts.CallExpression): string {
		if (ts.isIdentifier(call.expression)) {
			return call.expression.text;
		}
		if (ts.isPropertyAccessExpression(call.expression)) {
			return call.expression.name.text;
		}
		return "";
	}
}
