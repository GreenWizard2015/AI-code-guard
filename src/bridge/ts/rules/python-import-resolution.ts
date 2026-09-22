import { existsSync } from 'node:fs';
import { dirname } from 'node:path';
import { join } from 'node:path';
import type { AstPythonImport, AstPythonImportName } from 'src/types';
import type { ImportedFunction } from 'src/types';

/** Responsibilities: _resolution Python import sources_. **/
export class PythonImportResolution {
	private readonly python_suffix = '.py';
	private readonly package_file = '__init__.py';

	/** Responsibilities: _resolution Python module name_. **/
	private import_source(file: string, module_name: string): string {
		const level = this.relative_import_level(module_name);
		if (level === 0) {
			return '';
		}
		const base = this.relative_import_base(file, level);
		const module = module_name.slice(level);
		let module_path = base;
		if (module.length > 0) {
			module_path = join(base, ...module.split('.'));
		}
		return this.import_file(module_path);
	}

	/** Responsibilities: _selection Python module package_. **/
	private import_file(module_path: string): string {
		const module_file = `${module_path}${this.python_suffix}`;
		if (existsSync(module_file)) {
			return module_file;
		}
		const package_path = join(module_path, this.package_file);
		if (existsSync(package_path)) {
			return package_path;
		}
		return '';
	}

	/** Responsibilities: _relative leading-dot count_. **/
	private relative_import_level(module_name: string): number {
		let level = 0;
		while (module_name[level] === '.') {
			level += 1;
		}
		return level;
	}

	/** Responsibilities: _resolution package base relative_. **/
	private relative_import_base(file: string, level: number): string {
		let base = dirname(file);
		for (let index = 1; index < level; index += 1) {
			base = dirname(base);
		}
		return base;
	}

	/** Responsibilities: _aggregation normalization names imported_. **/
	public append_import_names(
		imports: Map<string, ImportedFunction>,
		names: AstPythonImportName[],
		source_file: string
	): void {
		for (const name of names) {
			let alias = name.name;
			if (name.alias !== undefined) {
				alias = name.alias;
			}
			imports.set(alias, { source_file: source_file, source_name: name.name });
		}
	}

	/** Responsibilities: _collection resolution Python imports_. **/
	public collect_imports(
		file: string,
		python_imports: AstPythonImport[]
	): Map<string, ImportedFunction> {
		const imports = new Map<string, ImportedFunction>();
		for (const item of python_imports) {
			const source_file = this.import_source(file, item.module);
			if (source_file.length === 0) {
				continue;
			}
			this.append_import_names(imports, item.names, source_file);
		}
		return imports;
	}
}
