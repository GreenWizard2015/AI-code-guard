import { TypeScriptModuleExports } from "src/module-resolution/type_script_module_exports";
import type { CallableReferenceIdentity } from "src/types";
import ts from "typescript";
import type { TypeScriptModuleResolverContract } from "src/module-resolution/protocols";
import type { ProjectSourceIOContract } from "src/source_protocols";

/** Responsibilities: _imported callable binding collection_, _local alias indexing_. **/
export class TypeScriptReferenceImportState {
	private readonly source_file: ts.SourceFile;
	private readonly project_root: string;
	private readonly source_files: ReadonlyMap<string, ts.SourceFile>;
	private readonly module_exports: TypeScriptModuleResolverContract;

	/** Responsibilities: _function import binding_. **/
	private append_function_binding(
		element: ts.ImportSpecifier,
		imported_file: string,
		module_exports: TypeScriptModuleResolverContract,
		function_identities: Map<string, CallableReferenceIdentity>,
	): void {
		let exported_name = element.name.text;
		if (element.propertyName !== undefined) {
			exported_name = element.propertyName.text;
		}
		const resolved = module_exports.resolve(imported_file, exported_name);
		let target_file = imported_file;
		let target_name = exported_name;
		if (resolved.file.length > 0) {
			target_file = resolved.file;
		}
		if (resolved.name.length > 0) {
			target_name = resolved.name;
		}
		function_identities.set(element.name.text, { name: target_name, target_file: target_file });
	}

	/** Responsibilities: _named import bindings_. **/
	private named_imports(statement: ts.Statement): readonly ts.ImportSpecifier[] {
		if (!ts.isImportDeclaration(statement)) {
			return [];
		}
		const bindings = statement.importClause?.namedBindings;
		if (bindings === undefined) {
			return [];
		}
		if (!ts.isNamedImports(bindings)) {
			return [];
		}
		return bindings.elements;
	}

	/** Responsibilities: _imported module file_. **/
	private imported_file(statement: ts.Statement, module_exports: TypeScriptModuleResolverContract): string {
		if (!ts.isImportDeclaration(statement)) {
			return "";
		}
		if (!ts.isStringLiteral(statement.moduleSpecifier)) {
			return "";
		}
		return module_exports.module_symbol(this.source_file.fileName, statement.moduleSpecifier.text);
	}

	/** Responsibilities: _function import statement_. **/
	private append_function_statement(
		statement: ts.Statement,
		module_exports: TypeScriptModuleResolverContract,
		function_identities: Map<string, CallableReferenceIdentity>,
	): void {
		const imported_file = this.imported_file(statement, module_exports);
		if (imported_file.length === 0) {
			return;
		}
		for (const element of this.named_imports(statement)) {
			this.append_function_binding(element, imported_file, module_exports, function_identities);
		}
	}

	/** Responsibilities: _local import alias binding_. **/
	private local_binding_name(imported_file: string, element: ts.ImportSpecifier): string {
		let imported_name = element.name.text;
		if (element.propertyName !== undefined) {
			imported_name = element.propertyName.text;
		}
		const resolved = this.module_exports.resolve(imported_file, imported_name);
		if (resolved.name.length > 0) {
			return resolved.name;
		}
		return imported_name;
	}

	/** Responsibilities: _local import alias binding_. **/
	private append_local_binding(statement: ts.Statement, aliases: Map<string, string>): void {
		const imported_file = this.imported_file(statement, this.module_exports);
		if (imported_file.length === 0) {
			return;
		}
		for (const element of this.named_imports(statement)) {
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
		this.source_file = source_file;
		this.project_root = project_root;
		this.source_files = source_files;
		this.module_exports = new TypeScriptModuleExports(this.project_root, this.source_files, false, source_io);
	}

	/** Responsibilities: _imported function file mapping_. **/
	public append_function_files(function_identities: Map<string, CallableReferenceIdentity>): void {
		for (const statement of this.source_file.statements) {
			this.append_function_statement(statement, this.module_exports, function_identities);
		}
	}

	/** Responsibilities: _local import alias mapping_. **/
	public append_local_aliases(aliases: Map<string, string>): void {
		for (const statement of this.source_file.statements) {
			this.append_local_binding(statement, aliases);
		}
	}
}
