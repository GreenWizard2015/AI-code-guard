import { existsSync } from 'node:fs';
import { readFileSync } from 'node:fs';
import { dirname } from 'node:path';
import { join } from 'node:path';
import type { AstPythonImport, AstPythonImportName, ImportedSymbol, NormalizedAstFile } from 'src/types';
import { PythonAstData } from 'src/bridge/ts/core/python-ast-parser';

/** Responsibilities: _resolution Python relative imports_. **/
export class PythonCompositionImports {
	private readonly module_suffixes = ['.py', '/__init__.py'] as const;
	private readonly python_ast_parser = new PythonAstData();

	/** Responsibilities: _relative leading-dot count_. **/
	private relative_import_level(source: string): number {
		let level = 0;
		while (source[level] === '.') level += 1;
		return level;
	}

	/** Responsibilities: _resolution package base relative_. **/
	private relative_import_base(importer: string, level: number): string {
		let base = dirname(importer);
		for (let index = 1; index < level; index += 1) {
			base = dirname(base);
		}
		return base;
	}

	/** Responsibilities: _module package candidate generation_. **/
	private module_candidates(module_path: string): string[] {
		const candidates: string[] = [];
		for (const suffix of this.module_suffixes) {
			if (suffix.startsWith('/')) {
				candidates.push(join(module_path, suffix.slice(1)));
			} else {
				candidates.push(`${module_path}${suffix}`);
			}
		}
		return candidates;
	}

	/** Responsibilities: _resolution Python import source_. **/
	private python_import_path(importer: string, source: string): string {
		const level = this.relative_import_level(source);
		if (level === 0) {
			return '';
		}
		const base = this.relative_import_base(importer, level);
		const module = source.slice(level);
		let module_path = base;
		if (module) {
			module_path = join(base, ...module.split('.'));
		}
		const candidates = this.module_candidates(module_path);
		const result = candidates.find(existsSync);
		if (result === undefined) {
			return '';
		}
		return result;
	}

	/** Responsibilities: _discovery import statements exporting_. **/
	private exported_imports(ast: NormalizedAstFile, name: string): AstPythonImport[] {
		const imports = ast.python_imports;
		if (imports === undefined) {
			return [];
		}
		return imports.filter(item => item.module.startsWith('.') && item.names.some(imported => {
			let exported_name = imported.name;
			if (imported.alias !== undefined) {
				exported_name = imported.alias;
			}
			return exported_name === name;
		}));
	}

	/** Responsibilities: _resolution local exported name_. **/
	private exported_name(item: AstPythonImportName): string {
		if (item.alias !== undefined) {
			return item.alias;
		}
		return item.name;
	}

	/** Responsibilities: _construction imported symbol record_. **/
	private exported_item_symbol(
		source_file: string,
		item: AstPythonImport,
		name: string
	): ImportedSymbol {
		const target = this.python_import_path(source_file, item.module);
		if (target.length === 0) {
			return { file: '', name: '' };
		}
		for (const imported of item.names) {
			if (this.exported_name(imported) === name) {
				return this.exported_symbol(target, imported.name);
			}
		}
		return { file: '', name: '' };
	}

	/** Responsibilities: _construction symbol record exported_. **/
	private exported_symbol(source_file: string, name: string): ImportedSymbol {
		if (!source_file.endsWith('/__init__.py')) {
			return { file: source_file, name };
		}
		const ast = this.python_ast_parser.source_ast(readFileSync(source_file, 'utf8'));
		for (const item of this.exported_imports(ast, name)) {
			const exported = this.exported_item_symbol(source_file, item, name);
			if (exported.file.length > 0) {
				return exported;
			}
		}
		return { file: source_file, name };
	}

	/** Responsibilities: _resolution Python imports addition_. **/
	public add_python_import(
		result: Map<string, ImportedSymbol>,
		file: string,
		item: AstPythonImport
	): void {
		const source_file = this.python_import_path(file, item.module);
		if (source_file.length === 0) {
			return;
		}
		for (const name of item.names) {
			if (name.name !== '*') {
				let imported_name = name.name;
				if (name.alias !== undefined) {
					imported_name = name.alias;
				}
				const exported = this.exported_symbol(source_file, name.name);
				result.set(imported_name, exported);
			}
		}
	}

	/** Responsibilities: _collection resolution Python imports_. **/
	public python_imports(
		file: string,
		imports: AstPythonImport[]
	): Map<string, ImportedSymbol> {
		const result = new Map<string, ImportedSymbol>();
		for (const item of imports) {
			this.add_python_import(result, file, item);
		}
		return result;
	}
}
