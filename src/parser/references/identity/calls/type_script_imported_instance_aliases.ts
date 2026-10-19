import { TypeScriptModuleExports as TypeScriptSourceExports } from "src/parser/analysis/type_script_module_exports";
import { TypeScriptModuleExports } from "src/module-resolution/type_script_module_exports";
import type { ModulePathResolver, TypeScriptModuleExportLookupContract } from "src/module-resolution/types";
import ts from "typescript";
import type { ProjectSourceIOContract } from "src/protocols";

/** Responsibilities: _imported instance owner resolution_, _import alias collection_. **/
export class TypeScriptImportedInstanceAliases {
	private readonly module_exports: ModulePathResolver;
	private readonly source_exports: TypeScriptModuleExportLookupContract;

	/** Responsibilities: _resolution import source absolute_. **/
	private imported_file_path(source_file: ts.SourceFile, statement: ts.Statement): string {
		if (!ts.isImportDeclaration(statement) || !ts.isStringLiteral(statement.moduleSpecifier)) {
			return "";
		}
		const file = this.module_exports.module_symbol(source_file.fileName, statement.moduleSpecifier.text);
		if (file !== undefined) {
			return file;
		}
		return "";
	}

	/** Responsibilities: _extraction named import bindings_. **/
	private imported_named_bindings(statement: ts.Statement): ts.NamedImports[] {
		if (!ts.isImportDeclaration(statement)) {
			return [];
		}
		const bindings = statement.importClause?.namedBindings;
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
		for (const declaration of this.source_exports.resolved_exported_declaration(file, exported_name)) {
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
		this.module_exports = new TypeScriptModuleExports(project_root, source_files, false, source_io);
		this.source_exports = new TypeScriptSourceExports(project_root, source_files, false, source_io);
	}

	/** Responsibilities: _resolution imported instance addition_. **/
	public add_imported_instances(
		source_file: ts.SourceFile,
		statement: ts.Statement,
		instances: Map<string, string>,
	): void {
		const imported_file = this.imported_file_path(source_file, statement);
		if (!imported_file) {
			return;
		}
		for (const named_bindings of this.imported_named_bindings(statement)) {
			this.add_imported_bindings(named_bindings, imported_file, instances);
		}
	}

	/** Responsibilities: _collection imported instance aliases_. **/
	public imported_instance_aliases(source_file: ts.SourceFile): Map<string, string> {
		const instances = new Map<string, string>();
		for (const statement of source_file.statements) {
			this.add_imported_instances(source_file, statement, instances);
		}
		return instances;
	}
}
