import type { AstPythonImport, AstPythonImportName } from "src/types";

/** Responsibilities: _package export indexing_, _import snapshot comparison_. **/
export class PythonExportIndex {
	private readonly source_imports: AstPythonImport[];
	private readonly imports_by_name: Map<string, AstPythonImport[]>;

	/** Responsibilities: _Python export name selection_. **/
	private exported_name(item: AstPythonImportName): string {
		if (item.alias.length > 0) {
			return item.alias;
		}
		return item.name;
	}

	/** Responsibilities: _Python export name indexing_. **/
	private append_name(item: AstPythonImport, imported: AstPythonImportName, names: Set<string>): void {
		const name = this.exported_name(imported);
		if (names.has(name)) {
			return;
		}
		names.add(name);
		let entries = this.imports_by_name.get(name);
		if (entries === undefined) {
			entries = [];
			this.imports_by_name.set(name, entries);
		}
		entries.push(item);
	}

	/** Responsibilities: _Python export index initialization_. **/
	public constructor(imports: AstPythonImport[]) {
		this.source_imports = imports;
		this.imports_by_name = new Map();
	}

	/** Responsibilities: _Python export statement indexing_. **/
	public index_import(item: AstPythonImport): void {
		if (!item.module.startsWith(".")) {
			return;
		}
		const names = new Set<string>();
		for (const imported of item.names) {
			this.append_name(item, imported, names);
		}
	}

	/** Responsibilities: _Python export snapshot comparison_. **/
	public same_snapshot(imports: AstPythonImport[]): boolean {
		return this.source_imports === imports;
	}

	/** Responsibilities: _Python export statement lookup_. **/
	public named(name: string): readonly AstPythonImport[] {
		const entries = this.imports_by_name.get(name);
		if (entries === undefined) {
			return [];
		}
		return entries;
	}
}
