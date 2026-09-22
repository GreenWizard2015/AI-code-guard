import type { CodeClass, ImportedSymbol } from 'src/types';

/** Responsibilities: _resolution imported class keys_. **/
export class ClassDependencyMap {
	private readonly classes_by_file: Map<string, Map<string, CodeClass>>;

	private readonly imports_by_file: Map<string, Map<string, ImportedSymbol>>;

	/** Responsibilities: _resolution class key source_. **/
	private resolve_class_key(file: string, name: string): string {
		const local = this.classes_by_file.get(file)?.get(name);
		if (local) {
			return local.key;
		}
		const imported = this.imports_by_file.get(file)?.get(name);
		if (!imported) {
			return '';
		}
		return this.imported_class_key(imported);
	}

	/** Responsibilities: _resolution graph key imported_. **/
	private imported_class_key(imported: ImportedSymbol): string {
		const imported_classes = this.classes_by_file.get(imported.file);
		if (imported_classes === undefined) {
			return '';
		}
		const resolved = imported_classes.get(imported.name)?.key;
		if (resolved === undefined) {
			return '';
		}
		return resolved;
	}

	/** Responsibilities: _initialization graph class indexing_. **/
	public constructor(
		classes_by_file: Map<string, Map<string, CodeClass>>,
		imports_by_file: Map<string, Map<string, ImportedSymbol>>
	) {
		this.classes_by_file = classes_by_file;
		this.imports_by_file = imports_by_file;
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
