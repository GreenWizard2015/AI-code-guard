import { existsSync } from 'node:fs';
import { statSync } from 'node:fs';
import { resolve } from 'node:path';
import { dirname } from 'node:path';
import { extname } from 'node:path';
import ts from 'typescript';
import { TypeScriptModuleExports } from 'src/module-resolution/resolver';
import type { ImportedFunction } from 'src/types';

/** Responsibilities: _resolution imported TypeScript function_. **/
export class TypeScriptImportedFunctionAliases {
	private readonly source_extensions = new Set(['.ts', '.tsx']);
	private readonly export_resolver = new TypeScriptModuleExports();

	/** Responsibilities: _candidate files imported generation_. **/
	private import_candidates(base: string): string[] {
		if (this.source_extensions.has(extname(base))) {
			return [base];
		}
		return [base, `${base}.ts`, `${base}.tsx`, resolve(base, './index.ts'), resolve(base, './index.tsx')];
	}

	/** Responsibilities: _aggregation imported function aliases_. **/
	private append_imported_functions(
		source_file: ts.SourceFile,
		statement: ts.Statement,
		imports: Map<string, ImportedFunction>
	): void {
		if (!ts.isImportDeclaration(statement)) {
			return;
		}
		if (!this.relative_module(statement)) {
			return;
		}
		const module_specifier = statement.moduleSpecifier;
		const named = statement.importClause?.namedBindings;
		if ((!ts.isStringLiteral(module_specifier)) || (!named) || (!ts.isNamedImports(named))) {
			return;
		}
		const source_path = this.import_file(source_file, module_specifier.text);
		if (source_path) {
			this.add_imported_functions(named, source_path, imports);
		}
	}

	/** Responsibilities: _classification import statement relative_. **/
	private relative_module(statement: ts.Statement): boolean {
if (!ts.isImportDeclaration(statement) || !ts.isStringLiteral(statement.moduleSpecifier)) {
			return false;
		}
		return statement.moduleSpecifier.text.startsWith('.');
	}

	/** Responsibilities: _resolution storage imported function_. **/
	private add_imported_functions(
		named: ts.NamedImports,
		source_path: string,
		imports: Map<string, ImportedFunction>
	): void {
		for (const element of named.elements) {
			let source_name = element.name.text;
			if (element.propertyName) {
				source_name = element.propertyName.text;
			}
			const resolved = this.export_resolver.resolve(source_path, source_name);
			if (resolved.file.length > 0) {
				source_path = resolved.file;
				source_name = resolved.name;
			}
			imports.set(element.name.text, {
				source_file: source_path,
				source_name: source_name,
			});
		}
	}

	/** Responsibilities: _resolution imported module name_. **/
	public import_file(source_file: ts.SourceFile, module_name: string): string {
		const base = resolve(dirname(source_file.fileName), module_name);
		const candidates = this.import_candidates(base);
		const existing = candidates.find(
			candidate => existsSync(candidate) && statSync(candidate).isFile()
		);
		if (existing === undefined) {
			return '';
		}
		return existing;
	}

	/** Responsibilities: _collection imported function aliases_. **/
	public imported_function_aliases(source_file: ts.SourceFile): Map<string, ImportedFunction> {
		const imports = new Map<string, ImportedFunction>();
		for (const statement of source_file.statements) {
			this.append_imported_functions(source_file, statement, imports);
		}
		return imports;
	}
}
