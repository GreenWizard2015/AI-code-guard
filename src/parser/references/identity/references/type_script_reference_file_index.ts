import ts from "typescript";
import type { StringSetMap } from "src/protocols";
import type { TypeScriptModuleExportsContract } from "src/module-resolution/types";
import type {
	TypeScriptInstanceFilesContract,
	TypeScriptReferenceFileIndexContract,
} from "src/model/protocols";

/** Responsibilities: _imported class file indexing_, _receiver file resolution_. **/
export class TypeScriptReferenceFileIndex implements TypeScriptReferenceFileIndexContract {
	private readonly source_file: ts.SourceFile;
	private readonly module_exports: TypeScriptModuleExportsContract;
	private readonly imported_class_files: StringSetMap;
	private readonly imported_binding_files: Map<string, string>;
	private readonly instance_files: TypeScriptInstanceFilesContract;
	private readonly loaded_sources: Set<string>;
	private readonly local_class_names: Set<string>;

	/** Responsibilities: _local class-name collection_. **/
	private collect_local_classes(node: ts.Node): void {
		if (ts.isClassLike(node)) {
			const name = node.name;
			if (name !== undefined) {
				this.local_class_names.add(name.text);
			}
		}
		ts.forEachChild(node, (child) => this.collect_local_classes(child));
	}

	/** Responsibilities: _imported class registration_. **/
	private append_class_file(imported_name: string, imported_file: string, local_name: string): void {
		const resolved = this.module_exports.resolve(imported_file, imported_name);
		let target_file = imported_file;
		let target_name = imported_name;
		if (resolved.file.length > 0) {
			target_file = resolved.file;
		}
		if (resolved.name.length > 0) {
			target_name = resolved.name;
		}
		let files = this.imported_class_files.get(target_name);
		if (files === undefined) {
			files = new Set<string>();
			this.imported_class_files.set(target_name, files);
		}
		files.add(target_file);
		this.imported_binding_files.set(local_name, target_file);
	}

	/** Responsibilities: _named import extraction_. **/
	private named_imports(statement: ts.ImportDeclaration): readonly ts.ImportSpecifier[] {
		if (!ts.isStringLiteral(statement.moduleSpecifier)) {
			return [];
		}
		const clause = statement.importClause;
		if (clause === undefined || clause.namedBindings === undefined) {
			return [];
		}
		if (!ts.isNamedImports(clause.namedBindings)) {
			return [];
		}
		return clause.namedBindings.elements;
	}

	/** Responsibilities: _named import source resolution_. **/
	private imported_file(statement: ts.ImportDeclaration): string {
		if (!ts.isStringLiteral(statement.moduleSpecifier)) {
			return "";
		}
		return this.module_exports.module_symbol(this.source_file.fileName, statement.moduleSpecifier.text);
	}

	/** Responsibilities: _named import file collection_. **/
	private append_named_imports(statement: ts.ImportDeclaration): void {
		const elements = this.named_imports(statement);
		if (elements.length === 0) {
			return;
		}
		const imported_file = this.imported_file(statement);
		if (imported_file.length === 0) {
			return;
		}
		for (const element of elements) {
			let imported_name = element.name.text;
			if (element.propertyName !== undefined) {
				imported_name = element.propertyName.text;
			}
			this.append_class_file(imported_name, imported_file, element.name.text);
		}
	}

	/** Responsibilities: _reference file indexing initialization_. **/
	public constructor(
		source_file: ts.SourceFile,
		module_exports: TypeScriptModuleExportsContract,
		imported_binding_files: Map<string, string>,
		instance_files: TypeScriptInstanceFilesContract,
	) {
		this.source_file = source_file;
		this.module_exports = module_exports;
		this.imported_class_files = new Map<string, Set<string>>();
		this.imported_binding_files = imported_binding_files;
		this.instance_files = instance_files;
		this.loaded_sources = new Set<string>();
		this.local_class_names = new Set<string>();
	}

	/** Responsibilities: _source file indexing_. **/
	public index_source_file(source_file: ts.SourceFile): void {
		if (this.loaded_sources.has(source_file.fileName)) {
			return;
		}
		this.loaded_sources.add(source_file.fileName);
		this.collect_local_classes(source_file);
		for (const statement of source_file.statements) {
			if (ts.isImportDeclaration(statement)) {
				this.append_named_imports(statement);
			}
		}
		this.instance_files.collect(source_file);
	}

	/** Responsibilities: _imported class file lookup_. **/
	public imported_class_file(owner: string): string {
		const files = this.imported_class_files.get(owner);
		if (files === undefined || files.size !== 1) {
			return "";
		}
		const first_file = files.values().next();
		if (first_file.done) {
			return "";
		}
		return first_file.value;
	}

	/** Responsibilities: _local class file lookup_. **/
	public local_class_file(owner: string): string {
		this.index_source_file(this.source_file);
		if (this.local_class_names.has(owner)) {
			return this.source_file.fileName;
		}
		return "";
	}

	/** Responsibilities: _new receiver file resolution_. **/
	public new_receiver_file(expression: ts.NewExpression): string {
		this.index_source_file(this.source_file);
		if (!ts.isIdentifier(expression.expression)) {
			return "";
		}
		const imported_binding_file = this.imported_binding_files.get(expression.expression.text);
		if (imported_binding_file !== undefined && imported_binding_file.length > 0) {
			return imported_binding_file;
		}
		if (this.local_class_names.has(expression.expression.text)) {
			return this.source_file.fileName;
		}
		return "";
	}
}
