import type ts from "typescript";

import type { TypeScriptPropertyModuleResolverContract } from "src/module-resolution/types";
import { AstPropertySources } from "src/rules/typescript/syntax-rules/ast/ast_property_sources";
import { AstPropertyTypeQuery } from "src/rules/typescript/syntax-rules/ast/ast_property_type_query";
import type {
	AstPropertySourceIndexContract,
	AstPropertySourcesContract,
	AstPropertyTypeContract,
} from "src/source_protocols";
import type { SourceFileResolver } from "src/source_types";

/** Responsibilities: _property state cache_, _property type resolution_. **/
export class AstPropertyType implements AstPropertyTypeContract {
	private readonly _sources: AstPropertySourcesContract;
	private readonly _field_states: Map<string, string>;

	/** Responsibilities: _AST property type initialization_. **/
	public constructor(
		source_file: ts.SourceFile,
		source_resolver: SourceFileResolver,
		module_exports: TypeScriptPropertyModuleResolverContract,
		source_index: AstPropertySourceIndexContract,
	) {
		this._field_states = new Map<string, string>();
		this._sources = new AstPropertySources(source_file, source_resolver, module_exports, source_index);
	}

	/** Responsibilities: _resolution caching field state_. **/
	public field_state(base: ts.Identifier, property: string): string {
		const key = `${base.pos}\u0000${property}`;
		const cached = this._field_states.get(key);
		if (cached !== undefined) {
			return cached;
		}
		const query = new AstPropertyTypeQuery(this._sources, property);
		const state = query.state(base);
		this._field_states.set(key, state);
		return state;
	}
}
