import type { CodeClass, ImportedSymbol } from "src/types";
import type { ClassesByFile, ImportsByFile } from "src/linting/orchestration/runtime/composition/types";
import type { TypeScriptModuleExportsContract } from "src/module-resolution/types";

/** Responsibilities: _class identity resolution_, _dependency graph construction_. **/
export class ClassDependencyMap {
	private readonly classes_by_file: ClassesByFile;
	private readonly imports_by_file: ImportsByFile;
	private readonly export_resolver: TypeScriptModuleExportsContract;

	/** Responsibilities: _resolution class key source_. **/
	private local_class_key(file: string, name: string): string {
		const local = this.classes_by_file.get(file)?.get(name);
		if (local) {
			return local.key;
		}
		return "";
	}

	/** Responsibilities: _resolution namespace class symbol_. **/
	private namespace_import(file: string, name: string): ImportedSymbol {
		const separator = name.indexOf(".");
		if (separator <= 0) {
			return { file: "", name: "" };
		}
		const namespace_name = name.slice(0, separator);
		const namespace = this.imports_by_file.get(file)?.get(namespace_name);
		if (namespace === undefined) {
			return { file: "", name: "" };
		}
		return { file: namespace.file, name: name.slice(separator + 1) };
	}

	/** Responsibilities: _resolution imported class symbol_. **/
	private imported_symbol(file: string, name: string): ImportedSymbol {
		let imported = this.imports_by_file.get(file)?.get(name);
		if (imported === undefined) {
			imported = this.namespace_import(file, name);
		}
		return imported;
	}

	/** Responsibilities: _resolution class key source_. **/
	private resolve_class_key(file: string, name: string): string {
		const local_key = this.local_class_key(file, name);
		if (local_key.length > 0) {
			return local_key;
		}
		const imported = this.imported_symbol(file, name);
		if (imported.file.length === 0) {
			return "";
		}
		return this.imported_class_key(imported);
	}

	/** Responsibilities: _resolution graph key imported_. **/
	private class_key(file: string, name: string): string {
		const classes = this.classes_by_file.get(file);
		if (classes === undefined) {
			return "";
		}
		const class_node = classes.get(name);
		if (class_node === undefined) {
			return "";
		}
		return class_node.key;
	}

	/** Responsibilities: _resolution graph key imported_. **/
	private imported_class_key(imported: ImportedSymbol): string {
		const local_key = this.class_key(imported.file, imported.name);
		if (local_key.length > 0) {
			return local_key;
		}
		const exported = this.export_resolver.resolve(imported.file, imported.name);
		if (exported.file.length === 0) {
			return "";
		}
		return this.class_key(exported.file, exported.name);
	}

	/** Responsibilities: _initialization graph class indexing_. **/
	public constructor(
		classes_by_file: ClassesByFile,
		imports_by_file: ImportsByFile,
		export_resolver: TypeScriptModuleExportsContract,
	) {
		this.classes_by_file = classes_by_file;
		this.imports_by_file = imports_by_file;
		this.export_resolver = export_resolver;
	}

	/** Responsibilities: _dependency edges class addition_. **/
	public one_item(current: CodeClass): void {
		const dependencies: string[] = [];
		for (const name of current.dependencies) {
			const key = this.resolve_class_key(current.file, name);
			if (key.length > 0) {
				dependencies.push(key);
			}
		}
		current.dependencies = dependencies;
	}

	/** Responsibilities: _dependency edges supplied addition_. **/
	public all_items(classes: Iterable<CodeClass>): void {
		for (const current of classes) {
			this.one_item(current);
		}
	}
}
