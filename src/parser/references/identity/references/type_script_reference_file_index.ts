import type { StringSetMap } from "src/analysis_types";
import type { TypeScriptInstanceFilesContract, TypeScriptReferenceFileIndexContract } from "src/model/protocols";
import type { TypeScriptModuleExportsContract } from "src/module-resolution/types";
import ts from "typescript";

/** Responsibilities: _imported class file indexing_, _receiver file resolution_. **/
export class TypeScriptReferenceFileIndex implements TypeScriptReferenceFileIndexContract {
	private readonly _source_file: ts.SourceFile;
	private readonly _module_exports: TypeScriptModuleExportsContract;
	private readonly _imported_class_files: StringSetMap;
	private readonly _imported_binding_files: Map<string, string>;
	private readonly _instance_files: TypeScriptInstanceFilesContract;
	private readonly _loaded_sources: Set<string>;
	private readonly _local_class_names: Set<string>;

	/** Responsibilities: _imported class registration_. **/
	private append_class_file(imported_name: string, imported_file: string, local_name: string): void {
		const resolved = this._module_exports.resolve({ file: imported_file, name: imported_name });
		let target_file = imported_file;
		let target_name = imported_name;
		if (resolved.file.length > 0) {
			target_file = resolved.file;
		}
		if (resolved.name.length > 0) {
			target_name = resolved.name;
		}
		let files = this._imported_class_files.get(target_name);
		if (files === undefined) {
			files = new Set<string>();
			this._imported_class_files.set(target_name, files);
		}
		files.add(target_file);
		this._imported_binding_files.set(local_name, target_file);
	}

	/** Responsibilities: _named import extraction_. **/
	private named_imports(import_declaration: ts.ImportDeclaration): readonly ts.ImportSpecifier[] {
		if (!ts.isStringLiteral(import_declaration.moduleSpecifier)) {
			return [];
		}
		const clause = import_declaration.importClause;
		if (clause === undefined || clause.namedBindings === undefined) {
			return [];
		}
		if (!ts.isNamedImports(clause.namedBindings)) {
			return [];
		}
		return clause.namedBindings.elements;
	}

	/** Responsibilities: _named import source resolution_. **/
	private imported_file(import_declaration: ts.ImportDeclaration): string {
		if (!ts.isStringLiteral(import_declaration.moduleSpecifier)) {
			return "";
		}
		return this._module_exports.module_symbol(this._source_file.fileName, import_declaration.moduleSpecifier.text);
	}

	/** Responsibilities: _named import file collection_. **/
	private append_named_imports(named_import_declaration: ts.ImportDeclaration): void {
		const elements = this.named_imports(named_import_declaration);
		if (elements.length === 0) {
			return;
		}
		const imported_file = this.imported_file(named_import_declaration);
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
		this._source_file = source_file;
		this._module_exports = module_exports;
		this._imported_class_files = new Map<string, Set<string>>();
		this._imported_binding_files = imported_binding_files;
		this._instance_files = instance_files;
		this._loaded_sources = new Set<string>();
		this._local_class_names = new Set<string>();
	}

	/** Responsibilities: _source file indexing_. **/
	public index_source_file(source_file: ts.SourceFile): void {
		if (this._loaded_sources.has(source_file.fileName)) {
			return;
		}
		this._loaded_sources.add(source_file.fileName);
		for (const statement of source_file.statements) {
			if (ts.isImportDeclaration(statement)) {
				this.append_named_imports(statement);
			}
		}
		this._instance_files.collect(
			source_file,
			{ owner_file: source_file.fileName, owner_class: "" },
			this._local_class_names,
		);
	}

	/** Responsibilities: _imported class file lookup_. **/
	public imported_class_file(owner: string): string {
		const files = this._imported_class_files.get(owner);
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
		this.index_source_file(this._source_file);
		if (this._local_class_names.has(owner)) {
			return this._source_file.fileName;
		}
		return "";
	}

	/** Responsibilities: _new receiver file resolution_. **/
	public new_receiver_file(expression: ts.NewExpression): string {
		this.index_source_file(this._source_file);
		if (!ts.isIdentifier(expression.expression)) {
			return "";
		}
		const imported_binding_file = this._imported_binding_files.get(expression.expression.text);
		if (imported_binding_file !== undefined && imported_binding_file.length > 0) {
			return imported_binding_file;
		}
		if (this._local_class_names.has(expression.expression.text)) {
			return this._source_file.fileName;
		}
		return "";
	}
}
