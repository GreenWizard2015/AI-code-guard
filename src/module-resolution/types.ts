import type ts from 'typescript';

export type ResolvedTypeScriptExport = {
	file: string;
	name: string;
};

export type RecursiveExportResolver = {
	file_for(file: string, name: string, visited: Set<string>): ResolvedTypeScriptExport;
	local_symbol(
		file: string,
		source_file: ts.SourceFile,
		name: string,
		visited: Set<string>
	): ResolvedTypeScriptExport;
};

export type ModulePathResolver = {
	module_symbol(file: string, module_name: string): string;
};
