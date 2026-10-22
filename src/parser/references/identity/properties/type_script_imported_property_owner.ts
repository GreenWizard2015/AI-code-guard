import ts from "typescript";
import { TypeScriptModuleExports } from "src/module-resolution/type_script_module_exports";
import type { TypeScriptModuleExportsContract, ResolvedTypeScriptExport } from "src/module-resolution/types";
import { TypeScriptReferenceType } from "src/parser/analysis/type_script_reference_type";
import type { ProjectSourceIOContract } from "src/source_protocols";

/** Responsibilities: _imported type property ownership_, _canonical property owner resolution_. **/
export class TypeScriptImportedPropertyOwner {
	private readonly source_file: ts.SourceFile;
	private readonly source_files: ReadonlyMap<string, ts.SourceFile>;
	private readonly module_exports: TypeScriptModuleExportsContract;
	private readonly owner_files: Map<string, string>;

	/** Responsibilities: _named declaration classification_. **/
	private is_owner_declaration(statement: ts.Statement, name: string): boolean {
		if (ts.isClassLike(statement)) {
		return statement.name?.text === name;
		}
		if (ts.isInterfaceDeclaration(statement)) {
		return statement.name.text === name;
		}
		if (ts.isTypeAliasDeclaration(statement)) {
			return statement.name.text === name;
		}
		return false;
	}

	/** Responsibilities: _local declaration lookup_. **/
	private local_declaration(file: string, name: string): ResolvedTypeScriptExport {
		const source = this.source_files.get(file);
		if (source === undefined) {
			return { file: "", name: "" };
		}
		for (const statement of source.statements) {
			if (this.is_owner_declaration(statement, name)) {
				return { file, name };
			}
		}
		return { file: "", name: "" };
	}

	/** Responsibilities: _named import binding extraction_. **/
	private import_bindings(statement: ts.Statement): readonly ts.ImportSpecifier[] {
		if (!ts.isImportDeclaration(statement)) {
			return [];
		}
		if (!ts.isStringLiteral(statement.moduleSpecifier)) {
			return [];
		}
		const bindings = statement.importClause?.namedBindings;
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
		file: string,
		statement: ts.Statement,
		binding: ts.ImportSpecifier,
	): ResolvedTypeScriptExport {
		if (!ts.isImportDeclaration(statement) || !ts.isStringLiteral(statement.moduleSpecifier)) {
			return { file: "", name: "" };
		}
		const module_file = this.module_exports.module_symbol(file, statement.moduleSpecifier.text);
		if (!module_file) {
			return { file: "", name: "" };
		}
		const imported_name = this.imported_name(binding);
		const resolved = this.module_exports.resolve(module_file, imported_name);
		if (resolved.file) {
			return resolved;
		}
		return { file: module_file, name: imported_name };
	}

	/** Responsibilities: _imported declaration lookup_. **/
	private imported_declaration(file: string, name: string): ResolvedTypeScriptExport {
		const source = this.source_files.get(file);
		if (source === undefined) {
			return { file: "", name: "" };
		}
		for (const statement of source.statements) {
			for (const binding of this.import_bindings(statement)) {
				if (binding.name.text === name) {
					return this.imported_binding_declaration(file, statement, binding);
				}
			}
		}
		return { file: "", name: "" };
	}

	/** Responsibilities: _declaration resolution_. **/
	/** Responsibilities: _declaration member extraction_. **/
	private declaration_members(statement: ts.Statement): readonly ts.Node[] {
		if (ts.isClassLike(statement)) {
			return statement.members;
		}
		if (ts.isInterfaceDeclaration(statement)) {
			return statement.members;
		}
		if (ts.isTypeAliasDeclaration(statement) && ts.isTypeLiteralNode(statement.type)) {
			return statement.type.members;
		}
		return [];
	}

	/** Responsibilities: _property member owner lookup_. **/
	private property_member_owner(member: ts.Node, property: string): string {
		if (!ts.isPropertySignature(member) && !ts.isPropertyDeclaration(member)) {
			return "";
		}
		if (member.name === undefined || !ts.isIdentifier(member.name)) {
			return "";
		}
		if (member.name.text !== property || member.type === undefined) {
			return "";
		}
		const reference_type = new TypeScriptReferenceType(member.type);
		return reference_type.return_owner();
	}

	/** Responsibilities: _property type owner lookup_. **/
	private property_type_name(file: string, owner: string, property: string): string {
		const source = this.source_files.get(file);
		if (source === undefined) {
			return "";
		}
		for (const statement of source.statements) {
			if (!this.is_owner_declaration(statement, owner)) {
				continue;
			}
			for (const member of this.declaration_members(statement)) {
				const type_name = this.property_member_owner(member, property);
				if (type_name) {
					return type_name;
				}
			}
		}
		return "";
	}

	/** Responsibilities: _property owner declaration lookup_. **/
	private owner_declaration(owner: string): ResolvedTypeScriptExport {
		const owner_file = this.owner_files.get(owner);
		if (owner_file !== undefined) {
			return { file: owner_file, name: owner };
		}
		return this.resolve_declaration(this.source_file.fileName, owner);
	}

	/** Responsibilities: _imported property owner initialization_. **/
	public constructor(
		source_file: ts.SourceFile,
		project_root: string,
		source_files: ReadonlyMap<string, ts.SourceFile>,
		source_io: ProjectSourceIOContract,
	) {
		this.source_file = source_file;
		this.source_files = source_files;
		this.module_exports = new TypeScriptModuleExports(project_root, source_files, false, source_io);
		this.owner_files = new Map<string, string>();
	}

	/** Responsibilities: _imported declaration resolution_. **/
	public resolve_declaration(file: string, name: string): ResolvedTypeScriptExport {
		const local = this.local_declaration(file, name);
		if (local.file) {
			return local;
		}
		return this.imported_declaration(file, name);
	}

	/** Responsibilities: _imported property owner resolution_. **/
	public property_owner(owner: string, property: string): string {
		const declaration = this.owner_declaration(owner);
		if (!declaration.file || !declaration.name) {
			return "";
		}
		const type_name = this.property_type_name(declaration.file, declaration.name, property);
		if (!type_name) {
			return "";
		}
		const resolved = this.resolve_declaration(declaration.file, type_name);
		if (!resolved.name) {
			return type_name;
		}
		this.owner_files.set(resolved.name, resolved.file);
		return resolved.name;
	}
}
