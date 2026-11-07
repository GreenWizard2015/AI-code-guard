import { TypeScriptDeclarationDefinition } from "src/module-resolution/declarations/type_script_declaration_definition";
import type { TypeScriptDeclarationDefinitionContract } from "src/module-resolution/protocols";
import { ResolvedTypeScriptDeclarationKind } from "src/module-resolution/types";
import type { TypeScriptModuleCache } from "src/module-resolution/types";
import type { TypeScriptDeclarationIndexContract } from "src/typescript_runtime_protocols";
import ts from "typescript";

import type { DeclarationIndexAddition, SymbolKindLookup } from "src/module-resolution/types";

/** Responsibilities: _symbol declaration indexing_, _declaration kind resolution_. **/
export class TypeScriptDeclarationIndex implements TypeScriptDeclarationIndexContract {
	private readonly _cache: TypeScriptModuleCache;
	private readonly _definitions: WeakMap<ts.Statement, TypeScriptDeclarationDefinitionContract>;

	/** Responsibilities: _syntax declaration identity_. **/
	private definition_for(statement: ts.Statement): TypeScriptDeclarationDefinitionContract {
		const cached = this._definitions.get(statement);
		if (cached !== undefined) {
			return cached;
		}
		const definition = new TypeScriptDeclarationDefinition(statement);
		this._definitions.set(statement, definition);
		return definition;
	}

	/** Responsibilities: _source declaration index_. **/
	private declaration_index(syntax_tree: ts.SourceFile): ReadonlyMap<string, readonly ts.Statement[]> {
		const cached = this._cache.declaration_indexes.get(syntax_tree);
		if (cached !== undefined) {
			return cached;
		}
		const index = new Map<string, ts.Statement[]>();
		for (const statement of syntax_tree.statements) {
			this.append_statement_names({ index, declaration: statement });
		}
		this._cache.declaration_indexes.set(syntax_tree, index);
		return index;
	}

	/** Responsibilities: _declaration names index addition_. **/
	private append_statement_names(addition: DeclarationIndexAddition): void {
		for (const name of this.definition_for(addition.declaration).names()) {
			const declarations = addition.index.get(name);
			if (declarations === undefined) {
				addition.index.set(name, [addition.declaration]);
				continue;
			}
			declarations.push(addition.declaration);
		}
	}

	/** Responsibilities: _symbol kind cache access_. **/
	private kind_cache(kind_source: ts.SourceFile): Map<string, ResolvedTypeScriptDeclarationKind> {
		let kinds = this._cache.symbol_kinds.get(kind_source);
		if (kinds === undefined) {
			kinds = new Map<string, ResolvedTypeScriptDeclarationKind>();
			this._cache.symbol_kinds.set(kind_source, kinds);
		}
		return kinds;
	}

	/** Responsibilities: _source symbol kind resolution_. **/
	private resolve_symbol_kind(lookup: SymbolKindLookup): ResolvedTypeScriptDeclarationKind {
		for (const statement of this.declarations_for(lookup.source_file, lookup.name)) {
			const kind = this.definition_for(statement).kind(lookup.name);
			if (kind !== ResolvedTypeScriptDeclarationKind.Other) {
				return kind;
			}
		}
		return ResolvedTypeScriptDeclarationKind.Other;
	}

	/** Responsibilities: _declaration index initialization_. **/
	public constructor(cache: TypeScriptModuleCache) {
		this._cache = cache;
		this._definitions = new WeakMap<ts.Statement, TypeScriptDeclarationDefinition>();
	}

	/** Responsibilities: _modifier presence_. **/
	public modifier_present(modifier_source: ts.Statement, kind: ts.SyntaxKind): boolean {
		if (!ts.canHaveModifiers(modifier_source)) {
			return false;
		}
		const modifiers = ts.getModifiers(modifier_source);
		if (modifiers === undefined) {
			return false;
		}
		return modifiers.some((modifier) => modifier.kind === kind);
	}

	/** Responsibilities: _indexed declarations lookup_. **/
	public declarations_for(lookup_file: ts.SourceFile, declared_name: string): readonly ts.Statement[] {
		const declarations = this.declaration_index(lookup_file).get(declared_name);
		if (declarations === undefined) {
			return [];
		}
		return declarations;
	}

	/** Responsibilities: _default declarations lookup_. **/
	public default_declarations(default_export_file: ts.SourceFile): readonly ts.Statement[] {
		const cached = this._cache.default_declarations.get(default_export_file);
		if (cached !== undefined) {
			return cached;
		}
		const declarations = default_export_file.statements.filter((statement) =>
			this.modifier_present(statement, ts.SyntaxKind.DefaultKeyword),
		);
		this._cache.default_declarations.set(default_export_file, declarations);
		return declarations;
	}

	/** Responsibilities: _export assignment lookup_. **/
	public export_assignments(export_file: ts.SourceFile): readonly ts.ExportAssignment[] {
		const cached = this._cache.export_assignments.get(export_file);
		if (cached !== undefined) {
			return cached;
		}
		const assignments = export_file.statements.filter(ts.isExportAssignment);
		this._cache.export_assignments.set(export_file, assignments);
		return assignments;
	}

	/** Responsibilities: _declaration kind classification_. **/
	public symbol_kind(symbol_file: ts.SourceFile, symbol_name: string): ResolvedTypeScriptDeclarationKind {
		const kinds = this.kind_cache(symbol_file);
		const cached = kinds.get(symbol_name);
		if (cached !== undefined) {
			return cached;
		}
		const result = this.resolve_symbol_kind({ source_file: symbol_file, name: symbol_name });
		kinds.set(symbol_name, result);
		return result;
	}
}
