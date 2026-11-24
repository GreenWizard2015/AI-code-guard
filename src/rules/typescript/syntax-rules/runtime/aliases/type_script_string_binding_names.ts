import { TypeScriptStringKeyNameCollection } from "src/parser/typescript-aliases/type_script_string_key_name_collection";
import type { SourceFileStringSetCache } from "src/source_types";
import ts from "typescript";

/** Responsibilities: _string binding-name analysis_, _dynamic key classification_. **/
export class TypeScriptStringBindingNames {
	private readonly _key_cache: SourceFileStringSetCache;

	/** Responsibilities: _string key cache initialization_. **/
	public constructor() {
		this._key_cache = new WeakMap<ts.SourceFile, ReadonlySet<string>>();
	}

	/** Responsibilities: _string key cache_. **/
	public string_key_names(source_file: ts.SourceFile): ReadonlySet<string> {
		const cached_names = this._key_cache.get(source_file);
		if (cached_names !== undefined) {
			return cached_names;
		}
		const collection = new TypeScriptStringKeyNameCollection();
		collection.append_declarations(source_file);
		collection.append_aliases(source_file);
		const names = collection._key_names;
		this._key_cache.set(source_file, names);
		return names;
	}

	/** Responsibilities: _dynamic property key_. **/
	public dynamic_key(access_node: ts.ElementAccessExpression, source_file: ts.SourceFile): boolean {
		if (ts.isCallExpression(access_node.expression) || ts.isNewExpression(access_node.expression)) {
			return false;
		}
		const key = access_node.argumentExpression;
		if (!ts.isIdentifier(key)) {
			return false;
		}
		return this.string_key_names(source_file).has(key.text);
	}
}
