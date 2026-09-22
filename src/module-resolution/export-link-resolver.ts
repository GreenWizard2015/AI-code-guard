import ts from 'typescript';
import type {
	ModulePathResolver,
	RecursiveExportResolver,
	ResolvedTypeScriptExport,
} from 'src/module-resolution/types';
import type { TypeScriptExportLinks } from 'src/module-resolution/protocols';

/** Responsibilities: _resolution named star imported_. **/
export class TypeScriptExportLinksTable implements TypeScriptExportLinks {
	private readonly resolver: RecursiveExportResolver;
	private readonly module_paths: ModulePathResolver;

	/** Responsibilities: _resolution source file referenced_. **/
	private imported_file(statement: ts.ImportDeclaration, file: string): string {
		const module_specifier = statement.moduleSpecifier;
		if (!ts.isStringLiteral(module_specifier)) {
			return '';
		}
		return this.module_paths.module_symbol(file, module_specifier.text);
	}

	/** Responsibilities: _resolution target declaration named_. **/
	private named_element_target(
		file: string,
		source_file: ts.SourceFile,
		statement: ts.ExportDeclaration,
		element: ts.ExportSpecifier,
		visited: Set<string>
	): ResolvedTypeScriptExport {
		let source_name = element.name.text;
		if (element.propertyName !== undefined) {
			source_name = element.propertyName.text;
		}
		const module_specifier = statement.moduleSpecifier;
		if (module_specifier === undefined) {
			return this.resolver.local_symbol(file, source_file, source_name, visited);
		}
		if (!ts.isStringLiteral(module_specifier)) {
			return this.resolver.local_symbol(file, source_file, source_name, visited);
		}
		const imported_file = this.module_paths.module_symbol(file, module_specifier.text);
		if (imported_file.length === 0) {
			return { file: '', name: '' };
		}
		return this.resolver.file_for(imported_file, source_name, visited);
	}

	/** Responsibilities: _resolution named export links_. **/
	private named_statement(
		file: string,
		source_file: ts.SourceFile,
		statement: ts.ExportDeclaration,
		name: string,
		visited: Set<string>
	): ResolvedTypeScriptExport {
		const export_clause = statement.exportClause;
if (export_clause === undefined || !ts.isNamedExports(export_clause)) {
			return { file: '', name: '' };
		}
		for (const element of export_clause.elements) {
			if (element.name.text === name) {
				return this.named_element_target(file, source_file, statement, element, visited);
			}
		}
		return { file: '', name: '' };
	}

	/** Responsibilities: _resolution star-export links source_. **/
	private star_statement(
		file: string,
		statement: ts.ExportDeclaration,
		name: string,
		visited: Set<string>
	): ResolvedTypeScriptExport {
		const module_specifier = statement.moduleSpecifier;
if (module_specifier === undefined || !ts.isStringLiteral(module_specifier)) {
			return { file: '', name: '' };
		}
		const imported_file = this.module_paths.module_symbol(file, module_specifier.text);
		if (imported_file.length === 0) {
			return { file: '', name: '' };
		}
		return this.resolver.file_for(imported_file, name, visited);
	}

	/** Responsibilities: _resolution local named binding_. **/
	private named_binding(
		imported_file: string,
		clause: ts.ImportClause,
		name: string,
		visited: Set<string>
	): ResolvedTypeScriptExport {
if (clause.namedBindings === undefined || !ts.isNamedImports(clause.namedBindings)) {
			return { file: '', name: '' };
		}
		for (const binding of clause.namedBindings.elements) {
			if (binding.name.text !== name) {
				continue;
			}
			let imported_name = binding.name.text;
			if (binding.propertyName !== undefined) {
				imported_name = binding.propertyName.text;
			}
			return this.resolver.file_for(imported_file, imported_name, visited);
		}
		return { file: '', name: '' };
	}

	/** Responsibilities: _initialization recursive export module_. **/
	constructor(resolver: RecursiveExportResolver, module_paths: ModulePathResolver) {
		this.resolver = resolver;
		this.module_paths = module_paths;
	}

	/** Responsibilities: _resolution named export target_. **/
	public named_export(
		file: string,
		source_file: ts.SourceFile,
		name: string,
		visited: Set<string>
	): ResolvedTypeScriptExport {
		for (const statement of source_file.statements) {
			if (!ts.isExportDeclaration(statement)) {
				continue;
			}
			const resolved = this.named_statement(file, source_file, statement, name, visited);
			if (resolved.file.length > 0) {
				return resolved;
			}
		}
		return { file: '', name: '' };
	}

	/** Responsibilities: _resolution star export target_. **/
	public star_export(
		file: string,
		source_file: ts.SourceFile,
		name: string,
		visited: Set<string>
	): ResolvedTypeScriptExport {
		for (const statement of source_file.statements) {
if (!ts.isExportDeclaration(statement) || statement.exportClause !== undefined) {
				continue;
			}
			const resolved = this.star_statement(file, statement, name, visited);
			if (resolved.file.length > 0) {
				return resolved;
			}
		}
		return { file: '', name: '' };
	}

	/** Responsibilities: _resolution exported target represented_. **/
	public imported_binding(
		file: string,
		statement: ts.ImportDeclaration,
		name: string,
		visited: Set<string>
	): ResolvedTypeScriptExport {
		const imported_file = this.imported_file(statement, file);
		const clause = statement.importClause;
		if (imported_file.length === 0) {
			return { file: '', name: '' };
		}
		if (clause === undefined) {
			return { file: '', name: '' };
		}
		if (clause.name !== undefined) {
			if (clause.name.text === name) {
				return this.resolver.file_for(imported_file, 'default', visited);
			}
		}
		return this.named_binding(imported_file, clause, name, visited);
	}

}
