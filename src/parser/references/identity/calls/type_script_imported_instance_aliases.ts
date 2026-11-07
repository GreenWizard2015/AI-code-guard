import { TypeScriptModuleExportsContext } from "src/module-resolution/exports/type_script_module_exports_context";
import type { ModulePathResolverContract, TypeScriptModuleExportLookupContract } from "src/module-resolution/types";
import { TypeScriptModuleExports as TypeScriptSourceExports } from "src/parser/analysis/type_script_module_exports";
import type { ProjectSourceIOContract } from "src/source_protocols";
import ts from "typescript";

/** Responsibilities: _imported instance owner resolution_, _import alias collection_. **/
export class TypeScriptImportedInstanceAliases {
	private readonly _module_exports: ModulePathResolverContract;
	private readonly _source_exports: TypeScriptModuleExportLookupContract;

	/** Responsibilities: _resolution import source absolute_. **/
	private imported_file_path(importer_source: ts.SourceFile, import_declaration: ts.Statement): string {
		if (!ts.isImportDeclaration(import_declaration)) {
			return "";
		}
		if (!ts.isStringLiteral(import_declaration.moduleSpecifier)) {
			return "";
		}
		const file = this._module_exports.module_symbol(importer_source.fileName, import_declaration.moduleSpecifier.text);
		if (file !== undefined) {
			return file;
		}
		return "";
	}

	/** Responsibilities: _extraction named import bindings_. **/
	private imported_named_bindings(import_statement: ts.Statement): ts.NamedImports[] {
		if (!ts.isImportDeclaration(import_statement)) {
			return [];
		}
		const bindings = import_statement.importClause?.namedBindings;
		if (!bindings || !ts.isNamedImports(bindings)) {
			return [];
		}
		return [bindings];
	}

	/** Responsibilities: _aliases imported instance addition_. **/
	private add_imported_bindings(
		bindings: ts.NamedImports,
		imported_file: string,
		instances: Map<string, string>,
	): void {
		for (const element of bindings.elements) {
			const owner = this.exported_instance_owner(imported_file, this.imported_binding_name(element));
			if (owner) {
				instances.set(element.name.text, owner);
			}
		}
	}

	/** Responsibilities: _resolution local name import_. **/
	private imported_binding_name(element: ts.ImportSpecifier): string {
		if (element.propertyName !== undefined) {
			return element.propertyName.text;
		}
		return element.name.text;
	}

	/** Responsibilities: _resolution owner exported instance_. **/
	private exported_instance_owner(file: string, exported_name: string): string {
		for (const declaration of this._source_exports.resolved_exported_declaration(file, exported_name)) {
			if (ts.isVariableDeclaration(declaration)) {
				return this.new_instance_owner(declaration);
			}
		}
		return "";
	}

	/** Responsibilities: _resolution class owner construction_. **/
	private new_instance_owner(declaration: ts.VariableDeclaration): string {
		if (declaration.initializer === undefined) {
			return "";
		}
		if (!ts.isNewExpression(declaration.initializer)) {
			return "";
		}
		if (!ts.isIdentifier(declaration.initializer.expression)) {
			return "";
		}
		return declaration.initializer.expression.text;
	}

	/** Responsibilities: _imported instance resolver initialization_. **/
	public constructor(
		project_root: string,
		source_files: ReadonlyMap<string, ts.SourceFile>,
		source_io: ProjectSourceIOContract,
	) {
		const exports_context = new TypeScriptModuleExportsContext(project_root, source_files, false, source_io);
		this._module_exports = exports_context.module_exports();
		this._source_exports = new TypeScriptSourceExports(project_root, source_files, false, source_io);
	}

	/** Responsibilities: _resolution imported instance addition_. **/
	public add_imported_instances(
		import_source: ts.SourceFile,
		instance_import: ts.Statement,
		instances: Map<string, string>,
	): void {
		const imported_file = this.imported_file_path(import_source, instance_import);
		if (!imported_file) {
			return;
		}
		for (const named_bindings of this.imported_named_bindings(instance_import)) {
			this.add_imported_bindings(named_bindings, imported_file, instances);
		}
	}

	/** Responsibilities: _collection imported instance aliases_. **/
	public imported_instance_aliases(alias_source: ts.SourceFile): Map<string, string> {
		const instances = new Map<string, string>();
		for (const statement of alias_source.statements) {
			this.add_imported_instances(alias_source, statement, instances);
		}
		return instances;
	}
}
