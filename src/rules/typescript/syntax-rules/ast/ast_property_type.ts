import type ts from "typescript";

import type { SourceFileResolverContract } from "src/core/project-source/types";
import type { TypeScriptPropertyModuleResolverContract } from "src/module-resolution/types";
import { AstPropertySources } from "src/rules/typescript/syntax-rules/ast/ast_property_sources";
import { AstPropertyTypeQuery } from "src/rules/typescript/syntax-rules/ast/ast_property_type_query";
import type {
	AstPropertyFieldStateMap,
	AstPropertySourceIndexContract,
	AstPropertySourcesContract,
	AstPropertyTypeContract,
} from "src/source_protocols";

/** Responsibilities: _property state cache_, _property type resolution_. **/
export class AstPropertyType implements AstPropertyTypeContract {
	private readonly _sources: AstPropertySourcesContract;
	private readonly _field_states: WeakMap<ts.Identifier, AstPropertyFieldStateMap>;

	/** Responsibilities: _AST property type initialization_. **/
	public constructor(
		source_file: ts.SourceFile,
		source_resolver: SourceFileResolverContract,
		module_exports: TypeScriptPropertyModuleResolverContract,
		source_index: AstPropertySourceIndexContract,
	) {
		this._field_states = new WeakMap<ts.Identifier, AstPropertyFieldStateMap>();
		this._sources = new AstPropertySources(source_file, source_resolver, module_exports, source_index);
	}

	/** Responsibilities: _resolution caching field state_. **/
	public field_state(base: ts.Identifier, property: string): string {
		let field_states = this._field_states.get(base);
		if (field_states === undefined) {
			field_states = new Map<string, string>();
			this._field_states.set(base, field_states);
		}
		const cached = field_states.get(property);
		if (cached !== undefined) {
			return cached;
		}
		const query = new AstPropertyTypeQuery(this._sources, property);
		const state = query.state(base);
		field_states.set(property, state);
		return state;
	}
}
