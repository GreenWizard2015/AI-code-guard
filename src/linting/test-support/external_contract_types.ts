import ts from "typescript";
import { EXTERNAL_DIRECTORY } from "src/constants";
import type { ExternalImportNames } from "src/linting/test-support/types";

/** Responsibilities: _external module classification_, _imported type identification_. **/
export class ExternalContractTypes {
	private readonly imported_names: WeakMap<ts.SourceFile, ExternalImportNames>;

	/** Responsibilities: _project module boundary_. **/
	private project_module(module_name: string): boolean {
		if (module_name.startsWith(".")) {
			return true;
		}
		return module_name.startsWith("src/") && !module_name.split("/").includes(EXTERNAL_DIRECTORY);
	}

	/** Responsibilities: _matching imported binding_. **/
	private append_import_names(statement: ts.ImportDeclaration, names: Set<string>): void {
		const clause = statement.importClause;
		if (clause === undefined || !ts.isStringLiteral(statement.moduleSpecifier)) {
			return;
		}
		if (this.project_module(statement.moduleSpecifier.text)) {
			return;
		}
		if (clause.name !== undefined) {
			names.add(clause.name.text);
		}
		this.append_import_bindings(clause, names);
	}

	/** Responsibilities: _import binding collection_. **/
	private append_import_bindings(clause: ts.ImportClause, names: Set<string>): void {
		const bindings = clause.namedBindings;
		if (bindings === undefined) {
			return;
		}
		if (ts.isNamespaceImport(bindings)) {
			names.add(bindings.name.text);
			return;
		}
		if (!ts.isNamedImports(bindings)) {
			return;
		}
		for (const element of bindings.elements) {
			names.add(element.name.text);
		}
	}

	/** Responsibilities: _external import identity index_. **/
	private external_import_names(source_file: ts.SourceFile): ExternalImportNames {
		const cached = this.imported_names.get(source_file);
		if (cached !== undefined) {
			return cached;
		}
		const names = new Set<string>();
		for (const statement of source_file.statements) {
			if (ts.isImportDeclaration(statement)) {
				this.append_import_names(statement, names);
			}
		}
		this.imported_names.set(source_file, names);
		return names;
	}

	/** Responsibilities: _external type cache initialization_. **/
	public constructor() {
		this.imported_names = new WeakMap<ts.SourceFile, ExternalImportNames>();
	}

	/** Responsibilities: _external contract import lookup_. **/
	public imports_external_name(source_file: ts.SourceFile, local_name: string): boolean {
		return this.external_import_names(source_file).has(local_name);
	}

	/** Responsibilities: _external contract type identification_. **/
	public external_contract_type(source_file: ts.SourceFile, type_node: ts.TypeNode): boolean {
		if (!ts.isTypeReferenceNode(type_node)) {
			return false;
		}
		let type_name = type_node.typeName;
		while (ts.isQualifiedName(type_name)) {
			type_name = type_name.left;
		}
		if (!ts.isIdentifier(type_name)) {
			return false;
		}
		return this.imports_external_name(source_file, type_name.text);
	}
}
