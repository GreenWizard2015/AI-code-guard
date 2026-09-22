import type ts from 'typescript';
import type { RecursiveExportResolver, ResolvedTypeScriptExport } from 'src/module-resolution/types';

/** Responsibilities: _define TypeScript declaration resolution_. **/
export interface TypeScriptDeclarations {
	direct_declaration(file: string, source_file: ts.SourceFile, name: string, require_export: boolean): ResolvedTypeScriptExport;
	default_declaration(file: string, source_file: ts.SourceFile, name: string): ResolvedTypeScriptExport;
	export_assignment(file: string, source_file: ts.SourceFile, name: string, visited: Set<string>, resolver: RecursiveExportResolver): ResolvedTypeScriptExport;
}
/** Responsibilities: _define TypeScript export-link resolution_. **/
export interface TypeScriptExportLinks {
	named_export(file: string, source_file: ts.SourceFile, name: string, visited: Set<string>): ResolvedTypeScriptExport;
	star_export(file: string, source_file: ts.SourceFile, name: string, visited: Set<string>): ResolvedTypeScriptExport;
	imported_binding(file: string, statement: ts.ImportDeclaration, name: string, visited: Set<string>): ResolvedTypeScriptExport;
}
