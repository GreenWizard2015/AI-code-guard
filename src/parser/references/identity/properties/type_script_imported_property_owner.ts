import { TypeScriptModuleExportsContext } from "src/module-resolution/exports/type_script_module_exports_context";
import type { TypeScriptModuleExportsContract, TypeScriptModuleSymbolReference } from "src/module-resolution/types";
import { TypeScriptPropertyTypeLookup } from "src/parser/references/identity/properties/type_script_property_type_lookup";
import type { ProjectSourceIOContract } from "src/source_protocols";
import ts from "typescript";

/** Responsibilities: _imported type property ownership_, _canonical property owner resolution_. **/
export class TypeScriptImportedPropertyOwner {
	private readonly _source_file: ts.SourceFile;
	private readonly _source_files: ReadonlyMap<string, ts.SourceFile>;
	private readonly _module_exports: TypeScriptModuleExportsContract;
	private readonly _owner_files: Map<string, string>;

	/** Responsibilities: _named declaration classification_. **/
	private is_owner_declaration(declaration: ts.Statement, declaration_name: string): boolean {
		if (ts.isClassLike(declaration)) {
			return declaration.name?.text === declaration_name;
		}
		if (ts.isInterfaceDeclaration(declaration)) {
			return declaration.name.text === declaration_name;
		}
		if (ts.isTypeAliasDeclaration(declaration)) {
			return declaration.name.text === declaration_name;
		}
		return false;
	}

	/** Responsibilities: _local declaration lookup_. **/
	private local_declaration(declaration_file: string, requested_name: string): TypeScriptModuleSymbolReference {
		const source = this._source_files.get(declaration_file);
		if (source === undefined) {
			return { file: "", name: "" };
		}
		for (const statement of source.statements) {
			if (this.is_owner_declaration(statement, requested_name)) {
				return { file: declaration_file, name: requested_name };
			}
		}
		return { file: "", name: "" };
	}

	/** Responsibilities: _named import binding extraction_. **/
	private import_bindings(import_declaration: ts.Statement): readonly ts.ImportSpecifier[] {
		if (!ts.isImportDeclaration(import_declaration)) {
			return [];
		}
		if (!ts.isStringLiteral(import_declaration.moduleSpecifier)) {
			return [];
		}
		const bindings = import_declaration.importClause?.namedBindings;
		if (bindings === undefined || !ts.isNamedImports(bindings)) {
			return [];
		}
		return bindings.elements;
	}

	/** Responsibilities: _imported symbol name resolution_. **/
	private imported_name(binding: ts.ImportSpecifier): string {
		if (binding.propertyName !== undefined) {
			return binding.propertyName.text;
		}
		return binding.name.text;
	}

	/** Responsibilities: _import binding declaration_. **/
	private imported_binding_declaration(
		importer_file: string,
		import_declaration: ts.Statement,
		binding: ts.ImportSpecifier,
	): TypeScriptModuleSymbolReference {
		if (!ts.isImportDeclaration(import_declaration)) {
			return { file: "", name: "" };
		}
		if (!ts.isStringLiteral(import_declaration.moduleSpecifier)) {
			return { file: "", name: "" };
		}
		const module_file = this._module_exports.module_symbol(importer_file, import_declaration.moduleSpecifier.text);
		if (!module_file) {
			return { file: "", name: "" };
		}
		const imported_name = this.imported_name(binding);
		const resolved = this._module_exports.resolve({ file: module_file, name: imported_name });
		if (resolved.file) {
			return resolved;
		}
		return { file: module_file, name: imported_name };
	}

	/** Responsibilities: _imported declaration lookup_. **/
	private imported_declaration(importer_file: string, local_binding_name: string): TypeScriptModuleSymbolReference {
		const source = this._source_files.get(importer_file);
		if (source === undefined) {
			return { file: "", name: "" };
		}
		for (const statement of source.statements) {
			for (const binding of this.import_bindings(statement)) {
				if (binding.name.text === local_binding_name) {
					return this.imported_binding_declaration(importer_file, statement, binding);
				}
			}
		}
		return { file: "", name: "" };
	}

	/** Responsibilities: _property owner declaration lookup_. **/
	private owner_declaration(requested_owner: string): TypeScriptModuleSymbolReference {
		const owner_file = this._owner_files.get(requested_owner);
		if (owner_file !== undefined) {
			return { file: owner_file, name: requested_owner };
		}
		return this.resolve_declaration(this._source_file.fileName, requested_owner);
	}

	/** Responsibilities: _imported property owner initialization_. **/
	public constructor(
		source_file: ts.SourceFile,
		project_root: string,
		source_files: ReadonlyMap<string, ts.SourceFile>,
		source_io: ProjectSourceIOContract,
	) {
		this._source_file = source_file;
		this._source_files = source_files;
		const exports_context = new TypeScriptModuleExportsContext(project_root, source_files, false, source_io);
		this._module_exports = exports_context.module_exports();
		this._owner_files = new Map<string, string>();
	}

	/** Responsibilities: _imported declaration resolution_. **/
	public resolve_declaration(source_file: string, requested_symbol: string): TypeScriptModuleSymbolReference {
		const local = this.local_declaration(source_file, requested_symbol);
		if (local.file) {
			return local;
		}
		return this.imported_declaration(source_file, requested_symbol);
	}

	/** Responsibilities: _imported property owner resolution_. **/
	public property_owner(owner: string, property: string): string {
		const declaration = this.owner_declaration(owner);
		if (!declaration.file || !declaration.name) {
			return "";
		}
		const property_lookup = new TypeScriptPropertyTypeLookup(this._source_files, declaration.name, property);
		const type_name = property_lookup.type_name(declaration.file);
		if (!type_name) {
			return "";
		}
		const resolved = this.resolve_declaration(declaration.file, type_name);
		if (!resolved.name) {
			return type_name;
		}
		this._owner_files.set(resolved.name, resolved.file);
		return resolved.name;
	}
}
