import type { CallableReferenceIdentity } from "src/model/ast/normalized_ast_types";
import { TypeScriptModuleExportsContext } from "src/module-resolution/exports/type_script_module_exports_context";
import type { TypeScriptModuleResolverContract } from "src/module-resolution/protocols";
import type { ProjectSourceIOContract } from "src/source_protocols";
import ts from "typescript";

/** Responsibilities: _imported callable binding collection_, _local alias indexing_. **/
export class TypeScriptReferenceImportState {
	private readonly _source_file: ts.SourceFile;
	private readonly _project_root: string;
	private readonly _source_files: ReadonlyMap<string, ts.SourceFile>;
	private readonly _module_exports: TypeScriptModuleResolverContract;

	/** Responsibilities: _function import binding_. **/
	private append_function_binding(
		element: ts.ImportSpecifier,
		imported_file: string,
		binding_resolver: TypeScriptModuleResolverContract,
		binding_identities: Map<string, CallableReferenceIdentity>,
	): void {
		let exported_name = element.name.text;
		if (element.propertyName !== undefined) {
			exported_name = element.propertyName.text;
		}
		const resolved = binding_resolver.resolve({ file: imported_file, name: exported_name });
		let target_file = imported_file;
		let target_name = exported_name;
		if (resolved.file.length > 0) {
			target_file = resolved.file;
		}
		if (resolved.name.length > 0) {
			target_name = resolved.name;
		}
		binding_identities.set(element.name.text, { name: target_name, target_file: target_file });
	}

	/** Responsibilities: _named import bindings_. **/
	private named_imports(import_declaration: ts.Statement): readonly ts.ImportSpecifier[] {
		if (!ts.isImportDeclaration(import_declaration)) {
			return [];
		}
		const import_clause = import_declaration.importClause;
		if (import_clause === undefined) {
			return [];
		}
		const bindings = import_clause.namedBindings;
		if (bindings === undefined) {
			return [];
		}
		if (!ts.isNamedImports(bindings)) {
			return [];
		}
		return bindings.elements;
	}

	/** Responsibilities: _imported module file_. **/
	private imported_file(module_statement: ts.Statement, file_resolver: TypeScriptModuleResolverContract): string {
		if (!ts.isImportDeclaration(module_statement)) {
			return "";
		}
		if (!ts.isStringLiteral(module_statement.moduleSpecifier)) {
			return "";
		}
		return file_resolver.module_symbol(this._source_file.fileName, module_statement.moduleSpecifier.text);
	}

	/** Responsibilities: _function import statement_. **/
	private append_function_statement(
		function_statement: ts.Statement,
		statement_resolver: TypeScriptModuleResolverContract,
		statement_identities: Map<string, CallableReferenceIdentity>,
	): void {
		const imported_file = this.imported_file(function_statement, statement_resolver);
		if (imported_file.length === 0) {
			return;
		}
		for (const element of this.named_imports(function_statement)) {
			this.append_function_binding(element, imported_file, statement_resolver, statement_identities);
		}
	}

	/** Responsibilities: _local import alias binding_. **/
	private local_binding_name(imported_file: string, element: ts.ImportSpecifier): string {
		let imported_name = element.name.text;
		if (element.propertyName !== undefined) {
			imported_name = element.propertyName.text;
		}
		const resolved = this._module_exports.resolve({ file: imported_file, name: imported_name });
		if (resolved.name.length > 0) {
			return resolved.name;
		}
		return imported_name;
	}

	/** Responsibilities: _local import alias binding_. **/
	private append_local_binding(local_statement: ts.Statement, aliases: Map<string, string>): void {
		const imported_file = this.imported_file(local_statement, this._module_exports);
		if (imported_file.length === 0) {
			return;
		}
		for (const element of this.named_imports(local_statement)) {
			aliases.set(element.name.text, this.local_binding_name(imported_file, element));
		}
	}

	/** Responsibilities: _import state source setup_. **/
	public constructor(
		source_file: ts.SourceFile,
		project_root: string,
		source_files: ReadonlyMap<string, ts.SourceFile>,
		source_io: ProjectSourceIOContract,
	) {
		this._source_file = source_file;
		this._project_root = project_root;
		this._source_files = source_files;
		const exports_context = new TypeScriptModuleExportsContext(
			this._project_root,
			this._source_files,
			false,
			source_io,
		);
		this._module_exports = exports_context.module_exports();
	}

	/** Responsibilities: _imported function file mapping_. **/
	public append_function_files(output_identities: Map<string, CallableReferenceIdentity>): void {
		for (const statement of this._source_file.statements) {
			this.append_function_statement(statement, this._module_exports, output_identities);
		}
	}

	/** Responsibilities: _local import alias mapping_. **/
	public append_local_aliases(aliases: Map<string, string>): void {
		for (const statement of this._source_file.statements) {
			this.append_local_binding(statement, aliases);
		}
	}
}
