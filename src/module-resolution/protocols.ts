import type ts from "typescript";
import type {
	RecursiveExportResolver,
	ResolvedTypeScriptDeclarationKind,
	ResolvedTypeScriptExport,
} from "src/module-resolution/types";

/** Responsibilities: _define TypeScript declaration resolution_. **/
export interface TypeScriptDeclarationsContract {
	exported_symbol(
		file: string,
		name: string,
		source_file: ts.SourceFile,
		visited: Set<string>,
	): ResolvedTypeScriptExport;
	direct_declaration(
		file: string,
		source_file: ts.SourceFile,
		name: string,
		require_export: boolean,
	): ResolvedTypeScriptExport;
	default_declaration(file: string, source_file: ts.SourceFile, name: string): ResolvedTypeScriptExport;
	export_assignment(
		file: string,
		source_file: ts.SourceFile,
		name: string,
		visited: Set<string>,
		resolver: RecursiveExportResolver,
	): ResolvedTypeScriptExport;
}
/** Responsibilities: _define TypeScript export-link resolution_. **/
export interface TypeScriptExportLinksContract {
	named_export(file: string, source_file: ts.SourceFile, name: string, visited: Set<string>): ResolvedTypeScriptExport;
	star_export(file: string, source_file: ts.SourceFile, name: string, visited: Set<string>): ResolvedTypeScriptExport;
	imported_binding(
		file: string,
		statement: ts.ImportDeclaration,
		name: string,
		visited: Set<string>,
	): ResolvedTypeScriptExport;
	imported_binding_name(
		file: string,
		statement: ts.ImportDeclaration,
		imported_name: string,
		visited: Set<string>,
	): ResolvedTypeScriptExport;
}

/** Responsibilities: _TypeScript module resolver_. **/
export interface TypeScriptModuleResolverContract {
	module_symbol(file: string, module_name: string): string;
	resolve(file: string, name: string): ResolvedTypeScriptExport;
	symbol_kind(file: string, name: string): ResolvedTypeScriptDeclarationKind;
}
