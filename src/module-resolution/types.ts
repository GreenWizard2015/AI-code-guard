import type { ProjectSourceIOContract } from "src/source_protocols";
import type ts from "typescript";

export type DeclarationIndexAddition = {
	readonly index: Map<string, ts.Statement[]>;
	readonly declaration: ts.Statement;
};

export type SymbolKindLookup = {
	readonly source_file: ts.SourceFile;
	readonly name: string;
};

/** Responsibilities: _TypeScript module symbol identity_. **/
export type TypeScriptModuleSymbolReference = {
	readonly file: string;
	readonly name: string;
};

/** Responsibilities: _recursive file export lookup_. **/
export type TypeScriptFileExportQuery = {
	readonly reference: TypeScriptModuleSymbolReference;
	readonly visited: Set<string>;
};

/** Responsibilities: _local symbol lookup_. **/
export type TypeScriptLocalSymbolQuery = {
	readonly reference: TypeScriptModuleSymbolReference;
	readonly source_file: ts.SourceFile;
	readonly visited: Set<string>;
};

/** Responsibilities: _TypeScript declaration lookup context_. **/
export type TypeScriptDeclarationLookup = {
	readonly file: string;
	readonly source_file: ts.SourceFile;
	readonly name: string;
};

/** Responsibilities: _direct declaration lookup request_. **/
export type TypeScriptDirectDeclarationQuery = {
	readonly declaration: TypeScriptDeclarationLookup;
	readonly require_export: boolean;
};

/** Responsibilities: _exported symbol lookup request_. **/
export type TypeScriptExportedSymbolQuery = {
	readonly declaration: TypeScriptDeclarationLookup;
	readonly visited: Set<string>;
};

export enum ResolvedTypeScriptDeclarationKind {
	Class = "class",
	Function = "function",
	Contract = "contract",
	Other = "other",
}

export type TypeScriptDeclarationIndex = ReadonlyMap<string, readonly ts.Statement[]>;
export type TypeScriptSourceFileMap = ReadonlyMap<string, ts.SourceFile>;
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
	base_path: string;
};
export type TypeScriptModuleResolutionOptions = {
	base_url: string;
	paths_base: string;
	package_conditions: readonly string[];
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
	non_relative_bases(module_name: string): string[];
	path_alias_configured(module_name: string): boolean;
	policy_key(filesystem_fallback: boolean): string;
}

/** Responsibilities: _project resolution cache access_. **/
export interface TypeScriptProjectResolutionCacheContract {
	resolution(project_root: string, filesystem_fallback: boolean): TypeScriptModuleResolutionContract;
}
export type TypeScriptModuleSymbolNameCache = Map<string, string>;
export type TypeScriptModuleSymbolScopeCache = Map<string, TypeScriptModuleSymbolNameCache>;
export type TypeScriptModuleSymbolCache = Map<string, TypeScriptModuleSymbolScopeCache>;
export type TypeScriptModuleCache = {
	module_symbols: TypeScriptModuleSymbolCache;
	resolved_exports: Map<string, TypeScriptModuleSymbolReference>;
	resolutions: WeakMap<ProjectSourceIOContract, TypeScriptProjectResolutionCacheContract>;
	declaration_indexes: WeakMap<ts.SourceFile, TypeScriptDeclarationIndex>;
	default_declarations: WeakMap<ts.SourceFile, readonly ts.Statement[]>;
	export_assignments: WeakMap<ts.SourceFile, readonly ts.ExportAssignment[]>;
	exported_declarations: WeakMap<ts.SourceFile, TypeScriptExportedDeclarationIndex>;
	named_export_indexes: WeakMap<ts.SourceFile, TypeScriptNamedExportIndex>;
	local_import_indexes: WeakMap<ts.SourceFile, TypeScriptLocalImportTableContract>;
	symbol_kinds: WeakMap<ts.SourceFile, TypeScriptSymbolKindIndex>;
};

/** Responsibilities: _module symbol resolution_. **/
export interface ModulePathResolverContract {
	module_symbol(file: string, module_name: string): string;
}

/** Responsibilities: _property export resolution_. **/
export interface TypeScriptPropertyModuleResolverContract extends ModulePathResolverContract {
	resolve(reference: TypeScriptModuleSymbolReference): TypeScriptModuleSymbolReference;
}

/** Responsibilities: _TypeScript module exports_. **/
export interface TypeScriptModuleExportsContract extends ModulePathResolverContract {
	resolve(reference: TypeScriptModuleSymbolReference): TypeScriptModuleSymbolReference;
	symbol_kind(resolved: TypeScriptModuleSymbolReference): ResolvedTypeScriptDeclarationKind;
}

/** Responsibilities: _TypeScript module export lookup_. **/
export interface TypeScriptModuleExportLookupContract {
	named_imports(statement: ts.Statement): ts.NamedImports[];
	imported_file(source_file: ts.SourceFile, statement: ts.Statement): string;
	resolved_exported_declaration(file: string, exported_name: string): ts.Node[];
}
