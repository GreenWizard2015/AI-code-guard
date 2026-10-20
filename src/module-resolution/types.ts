import type ts from "typescript";
import type { ProjectSourceIOContract } from "src/source_protocols";

/** Responsibilities: _TypeScript config host contract_. **/
export type ResolvedTypeScriptExport = {
	file: string;
	name: string;
};

export enum ResolvedTypeScriptDeclarationKind {
	Class = "class",
	Function = "function",
	Contract = "contract",
	Other = "other",
}

export type TypeScriptDeclarationIndex = ReadonlyMap<string, readonly ts.Statement[]>;
export type TypeScriptExportedDeclarationIndex = ReadonlyMap<string, readonly ts.Node[]>;
export type TypeScriptNamedExportLink = {
	statement: ts.ExportDeclaration;
	element: ts.ExportSpecifier;
};
export type TypeScriptNamedExportIndex = ReadonlyMap<string, readonly TypeScriptNamedExportLink[]>;
export type TypeScriptLocalImportBinding = {
	statement: ts.ImportDeclaration;
	imported_name: string;
};
export type TypeScriptPathMapping = {
	pattern: string;
	targets: readonly string[];
};
export type TypeScriptPathMappingMatch = {
	matched: boolean;
	suffix: string;
};
export type TypeScriptModuleResolutionOptions = {
	base_url: string;
	paths_base: string;
	paths: readonly TypeScriptPathMapping[];
};
/** Responsibilities: _local import binding collection_. **/
export interface TypeScriptLocalImportTableContract {
	collect(): void;
	bindings_for(name: string): readonly TypeScriptLocalImportBinding[];
}
export type TypeScriptSymbolKindIndex = Map<string, ResolvedTypeScriptDeclarationKind>;
/** Responsibilities: _module resolution contract_. **/
export interface TypeScriptModuleResolutionContract {
	mapped_bases(module_name: string): string[];
	path_alias_configured(module_name: string): boolean;
	policy_key(filesystem_fallback: boolean): string;
}
/** Responsibilities: _project resolution cache access_. **/
export interface TypeScriptProjectResolutionCacheContract {
	resolution(project_root: string, filesystem_fallback: boolean): TypeScriptModuleResolutionContract;
}
export type TypeScriptModuleCache = {
	module_symbols: Map<string, string>;
	resolved_exports: Map<string, ResolvedTypeScriptExport>;
	resolutions: WeakMap<ProjectSourceIOContract, TypeScriptProjectResolutionCacheContract>;
	declaration_indexes: WeakMap<ts.SourceFile, TypeScriptDeclarationIndex>;
	default_declarations: WeakMap<ts.SourceFile, readonly ts.Statement[]>;
	export_assignments: WeakMap<ts.SourceFile, readonly ts.ExportAssignment[]>;
	exported_declarations: WeakMap<ts.SourceFile, TypeScriptExportedDeclarationIndex>;
	named_export_indexes: WeakMap<ts.SourceFile, TypeScriptNamedExportIndex>;
	local_import_indexes: WeakMap<ts.SourceFile, TypeScriptLocalImportTableContract>;
	symbol_kinds: WeakMap<ts.SourceFile, TypeScriptSymbolKindIndex>;
};

export type RecursiveExportResolver = {
	file_for(file: string, name: string, visited: Set<string>): ResolvedTypeScriptExport;
	local_symbol(file: string, source_file: ts.SourceFile, name: string, visited: Set<string>): ResolvedTypeScriptExport;
};

export type ModulePathResolver = {
	module_symbol(file: string, module_name: string): string;
};

/** Responsibilities: _property export resolution_. **/
export interface TypeScriptPropertyModuleResolverContract extends ModulePathResolver {
	resolve(file: string, name: string): ResolvedTypeScriptExport;
}

/** Responsibilities: _TypeScript module exports_. **/
export interface TypeScriptModuleExportsContract extends RecursiveExportResolver, ModulePathResolver {
	resolve(file: string, name: string): ResolvedTypeScriptExport;
	symbol_kind(file: string, name: string): ResolvedTypeScriptDeclarationKind;
}

/** Responsibilities: _TypeScript module export lookup_. **/
export interface TypeScriptModuleExportLookupContract {
	named_imports(statement: ts.Statement): ts.NamedImports[];
	imported_file(source_file: ts.SourceFile, statement: ts.Statement): string;
	resolved_exported_declaration(file: string, exported_name: string): ts.Node[];
}
