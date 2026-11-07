import type {
	ModulePathResolverContract,
	ResolvedTypeScriptDeclarationKind,
	TypeScriptDirectDeclarationQuery,
	TypeScriptExportedSymbolQuery,
	TypeScriptFileExportQuery,
	TypeScriptLocalSymbolQuery,
	TypeScriptModuleCache,
	TypeScriptModuleSymbolReference,
	TypeScriptSourceFileMap,
} from "src/module-resolution/types";
import type { TypeScriptPathMapping } from "src/module-resolution/types";
import type { ProjectSourceIOContract } from "src/source_protocols";
import type ts from "typescript";

/** Responsibilities: _module export resolver initialization_. **/
export type TypeScriptModuleExportsInitialization = {
	readonly project_root: string;
	readonly module_paths: TypeScriptModulePathCatalogContract;
	readonly module_cache: TypeScriptModuleCache;
};

/** Responsibilities: _package import mapping lookup_. **/
export interface PackageImportMappingsContract {
	source_files(): readonly string[];
	mappings(conditions: ReadonlySet<string>): readonly TypeScriptPathMapping[];
}

/** Responsibilities: _compiler resolution bases_. **/
export type TypeScriptResolutionBases = {
	readonly base_url: string;
	readonly paths_base: string;
};

/** Responsibilities: _define TypeScript declaration resolution_. **/
export interface TypeScriptDeclarationsContract {
	exported_symbol(query: TypeScriptExportedSymbolQuery): TypeScriptModuleSymbolReference;
	direct_declaration(query: TypeScriptDirectDeclarationQuery): TypeScriptModuleSymbolReference;
}

/** Responsibilities: _TypeScript declaration definition_. **/
export interface TypeScriptDeclarationDefinitionContract {
	names(): readonly string[];
	kind(name: string): ResolvedTypeScriptDeclarationKind;
}
/** Responsibilities: _define TypeScript export-link resolution_. **/
export interface TypeScriptExportLinksContract {
	exported_target(
		file: string,
		source_file: ts.SourceFile,
		name: string,
		visited: Set<string>,
	): TypeScriptModuleSymbolReference;
	imported_binding_name(
		file: string,
		statement: ts.ImportDeclaration,
		imported_name: string,
		visited: Set<string>,
	): TypeScriptModuleSymbolReference;
}

/** Responsibilities: _TypeScript export lookup configuration_. **/
export type TypeScriptExportLookupOptions = {
	readonly file: string;
	readonly source_file: ts.SourceFile;
	readonly name: string;
	readonly visited: Set<string>;
	readonly resolver: TypeScriptModuleExportScopeContract;
	readonly module_paths: ModulePathResolverContract;
	readonly module_cache: TypeScriptModuleCache;
};

/** Responsibilities: _TypeScript module resolver_. **/
export interface TypeScriptModuleResolverContract {
	module_symbol(file: string, module_name: string): string;
	resolve(reference: TypeScriptModuleSymbolReference): TypeScriptModuleSymbolReference;
	symbol_kind(resolved: TypeScriptModuleSymbolReference): ResolvedTypeScriptDeclarationKind;
}

/** Responsibilities: _module source path catalog_. **/
export interface TypeScriptModulePathCatalogContract {
	symbol(base: string): string;
	source(file: string): TypeScriptModuleSourceContract;
	policy_key(): string;
	bases(importer_file: string, module_name: string): string[];
}

/** Responsibilities: _module source access_. **/
export interface TypeScriptModuleSourceContract {
	available(): boolean;
	source_file(): ts.SourceFile;
}

/** Responsibilities: _module source creation_. **/
export type TypeScriptModuleSourceOptions = {
	readonly file: string;
	readonly runtime_module: boolean;
	readonly shared_source_files: TypeScriptSourceFileMap;
	readonly filesystem_fallback: boolean;
	readonly loaded_source_files: Map<string, ts.SourceFile>;
	readonly source_io: ProjectSourceIOContract;
};

/** Responsibilities: _module export scope_. **/
export interface TypeScriptModuleExportScopeContract {
	file_for(query: TypeScriptFileExportQuery): TypeScriptModuleSymbolReference;
	local_symbol(query: TypeScriptLocalSymbolQuery): TypeScriptModuleSymbolReference;
}
