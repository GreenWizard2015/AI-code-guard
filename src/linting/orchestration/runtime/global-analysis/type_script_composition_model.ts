import ts from "typescript";
import type { CodeClass, ImportedSymbol } from "src/model/types/types";
import { TypeScriptConstructorDependencies } from "src/linting/orchestration/runtime/global-analysis/type_script_constructor_dependencies";
import type { LocalImport } from "src/linting/orchestration/runtime/composition/types";
import type { TypeScriptConstructorDependenciesContract } from "src/linting/orchestration/runtime/composition/protocols";
import type { TypeScriptModuleExportsContract } from "src/module-resolution/types";
import { ANONYMOUS_CLASS_NAME } from "src/constants";

/** Responsibilities: _class dependency extraction_, _imported class resolution_. **/
export class TypeScriptCompositionModel {
	private readonly file: string;
	private readonly source_file: ts.SourceFile;
	private readonly export_resolver: TypeScriptModuleExportsContract;
	private readonly dependency_collector: TypeScriptConstructorDependenciesContract;

	/** Responsibilities: _collection classes statement_. **/
	private classes_from_statement(statement: ts.Statement): CodeClass[] {
		if (ts.isClassDeclaration(statement)) {
			return [this.create_class(statement, ANONYMOUS_CLASS_NAME)];
		}
		if (!ts.isVariableStatement(statement)) {
			return [];
		}
		return statement.declarationList.declarations.flatMap((declaration) => this.class_from_declaration(declaration));
	}

	/** Responsibilities: _collection class variable declaration_. **/
	private class_from_declaration(declaration: ts.VariableDeclaration): CodeClass[] {
		const initializer = declaration.initializer;
		if (!initializer || !ts.isClassExpression(initializer)) {
			return [];
		}
		return [this.create_class(initializer, declaration.name.getText(this.source_file))];
	}

	/** Responsibilities: _local class name registration_. **/
	private append_local_class(names: Set<string>, statement: ts.Statement): void {
		if (ts.isClassDeclaration(statement)) {
			if (statement.name !== undefined) {
				names.add(statement.name.text);
			}
			return;
		}
		if (!ts.isVariableStatement(statement)) {
			return;
		}
		for (const declaration of statement.declarationList.declarations) {
			if (declaration.initializer && ts.isClassExpression(declaration.initializer)) {
				names.add(declaration.name.getText(this.source_file));
			}
		}
	}

	/** Responsibilities: _imported binding names_. **/
	private append_imported_bindings(names: Set<string>, bindings: ts.NamedImports): void {
		for (const item of bindings.elements) {
			names.add(item.name.text);
		}
	}

	/** Responsibilities: _import clause name registration_. **/
	private append_clause_names(names: Set<string>, clause: ts.ImportClause): void {
		if (clause.name !== undefined) {
			names.add(clause.name.text);
		}
		const bindings = clause.namedBindings;
		if (bindings === undefined) {
			return;
		}
		if (ts.isNamedImports(bindings)) {
			this.append_imported_bindings(names, bindings);
			return;
		}
		if (ts.isNamespaceImport(bindings)) {
			names.add(bindings.name.text);
		}
	}

	/** Responsibilities: _imported name registration_. **/
	private append_imported_names(names: Set<string>, statement: ts.Statement): void {
		if (!ts.isImportDeclaration(statement)) {
			return;
		}
		const clause = statement.importClause;
		if (clause === undefined) {
			return;
		}
		this.append_clause_names(names, clause);
	}

	/** Responsibilities: _known class name collection_. **/
	private known_class_names(): ReadonlySet<string> {
		const names = new Set<string>();
		for (const statement of this.source_file.statements) {
			this.append_local_class(names, statement);
			this.append_imported_names(names, statement);
		}
		return names;
	}

	/** Responsibilities: _construction class composition record_. **/
	private create_class(node: ts.ClassLikeDeclaration, fallback_name: string): CodeClass {
		let name = fallback_name;
		if (ts.isClassDeclaration(node)) {
			if (node.name !== undefined) {
				name = node.name.text;
			}
		}
		return {
			key: `${this.file}:${name}`,
			file: this.file,
			line: this.source_file.getLineAndCharacterOfPosition(node.getStart(this.source_file)).line,
			name,
			dependencies: this.property_dependencies(node),
		};
	}

	/** Responsibilities: _class property dependencies collection_. **/
	private property_dependencies(node: ts.ClassLikeDeclaration): string[] {
		const dependencies: string[] = [];
		for (const member of node.members) {
			if (ts.isPropertyDeclaration(member) && member.initializer) {
				dependencies.push(...this.dependency_collector.collect_new_expressions(member.initializer));
			}
		}
		dependencies.push(...this.dependency_collector.constructor_dependencies(node));
		return dependencies;
	}

	/** Responsibilities: _resolution local imports statement_. **/
	private local_import(statement: ts.Statement): LocalImport[] {
		if (!ts.isImportDeclaration(statement)) {
			return [];
		}
		const clause = statement.importClause;
		if (clause === undefined) {
			return [];
		}
		const file = this.local_import_file(statement);
		if (!file) {
			return [];
		}
		return [{ clause, file }];
	}

	/** Responsibilities: _resolution local import file_. **/
	private local_import_file(node: ts.ImportDeclaration): string {
		if (!ts.isStringLiteral(node.moduleSpecifier)) {
			return "";
		}
		const file = this.export_resolver.module_symbol(this.file, node.moduleSpecifier.text);
		if (file.length === 0) {
			return "";
		}
		return file;
	}

	/** Responsibilities: _import addition resolution_. **/
	private add_import(statement: ts.Statement, imports: Map<string, ImportedSymbol>): void {
		for (const resolved of this.local_import(statement)) {
			const { clause, file: imported_file } = resolved;
			if (clause.name) {
				imports.set(clause.name.text, this.imported_symbol(imported_file, "default"));
			}
			this.add_named_imports(clause, imported_file, imports);
		}
	}

	/** Responsibilities: _imported symbol resolution_. **/
	private imported_symbol(imported_file: string, imported_name: string): ImportedSymbol {
		const resolved = this.export_resolver.resolve(imported_file, imported_name);
		if (resolved.file.length > 0) {
			return { file: resolved.file, name: resolved.name };
		}
		return { file: imported_file, name: imported_name };
	}

	/** Responsibilities: _aggregation named imports clause_. **/
	private add_named_imports(
		clause: ts.ImportClause,
		imported_file: string,
		imports: Map<string, ImportedSymbol>,
	): void {
		if (clause.namedBindings === undefined) {
			return;
		}
		if (!ts.isNamedImports(clause.namedBindings)) {
			if (ts.isNamespaceImport(clause.namedBindings)) {
				imports.set(clause.namedBindings.name.text, { file: imported_file, name: "" });
			}
			return;
		}
		for (const item of clause.namedBindings.elements) {
			let imported_name = item.name.text;
			if (item.propertyName !== undefined) {
				imported_name = item.propertyName.text;
			}
			imports.set(item.name.text, this.imported_symbol(imported_file, imported_name));
		}
	}

	/** Responsibilities: _composition model state initialization_. **/
	public constructor(file: string, source_file: ts.SourceFile, export_resolver: TypeScriptModuleExportsContract) {
		this.file = file;
		this.source_file = source_file;
		this.export_resolver = export_resolver;
		this.dependency_collector = new TypeScriptConstructorDependencies(this.known_class_names());
	}

	/** Responsibilities: _local imports collection_. **/
	public imports(): Map<string, ImportedSymbol> {
		const imports = new Map<string, ImportedSymbol>();
		for (const statement of this.source_file.statements) {
			this.add_import(statement, imports);
		}
		return imports;
	}

	/** Responsibilities: _source classes collection_. **/
	public classes(): CodeClass[] {
		return this.source_file.statements.flatMap((statement) => this.classes_from_statement(statement));
	}
}
