import { ANONYMOUS_CLASS_NAME, TYPESCRIPT_LANGUAGE } from "src/constants";
import type { TypeScriptConstructorDependenciesContract } from "src/contracts/protocols/composition_protocols";
import type { LocalImport } from "src/contracts/types/composition_types";
import { TypeScriptCompositionNameCollector } from "src/linting/composition/type_script_composition_name_collector";
import { TypeScriptConstructorDependencies } from "src/linting/composition/type_script_constructor_dependencies";
import type { CodeClass, ImportedSymbol } from "src/model_types";
import type { TypeScriptModuleExportsContract } from "src/module-resolution/types";
import ts from "typescript";

/** Responsibilities: _class dependency extraction_, _imported class resolution_. **/
export class TypeScriptCompositionModel {
	private readonly _file: string;
	private readonly _source_file: ts.SourceFile;
	private readonly _export_resolver: TypeScriptModuleExportsContract;
	private readonly _dependency_collector: TypeScriptConstructorDependenciesContract;

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
		return [this.create_class(initializer, declaration.name.getText(this._source_file))];
	}

	/** Responsibilities: _construction class composition record_. **/
	private create_class(node: ts.ClassLikeDeclaration, fallback_name: string): CodeClass {
		let name = fallback_name;
		if (ts.isClassDeclaration(node) && node.name !== undefined) {
			name = node.name.text;
		}
		return {
			key: `${this._file}:${name}`,
			file: this._file,
			line: this._source_file.getLineAndCharacterOfPosition(node.getStart(this._source_file)).line,
			name,
			dependencies: this.property_dependencies(node),
			language: TYPESCRIPT_LANGUAGE,
		};
	}

	/** Responsibilities: _class property dependencies collection_. **/
	private property_dependencies(node: ts.ClassLikeDeclaration): string[] {
		const dependencies: string[] = [];
		for (const member of node.members) {
			if (ts.isPropertyDeclaration(member) && member.initializer) {
				dependencies.push(...this._dependency_collector.collect_new_expressions(member.initializer));
			}
		}
		dependencies.push(...this._dependency_collector.constructor_dependencies(node));
		return dependencies;
	}

	/** Responsibilities: _resolution local imports statement_. **/
	private local_import(resolvable_import: ts.ImportDeclaration): LocalImport[] {
		const clause = resolvable_import.importClause;
		if (clause === undefined) {
			return [];
		}
		const file = this.local_import_file(resolvable_import);
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
		const file = this._export_resolver.module_symbol(this._file, node.moduleSpecifier.text);
		if (file.length === 0) {
			return "";
		}
		return file;
	}

	/** Responsibilities: _import addition resolution_. **/
	private add_import(composition_import: ts.ImportDeclaration, imports: Map<string, ImportedSymbol>): void {
		for (const resolved of this.local_import(composition_import)) {
			const { clause, file: imported_file } = resolved;
			if (clause.name) {
				imports.set(clause.name.text, this.imported_symbol(imported_file, "default"));
			}
			this.add_named_imports(clause, imported_file, imports);
		}
	}

	/** Responsibilities: _imported symbol resolution_. **/
	private imported_symbol(imported_file: string, imported_name: string): ImportedSymbol {
		const resolved = this._export_resolver.resolve({ file: imported_file, name: imported_name });
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
		this._file = file;
		this._source_file = source_file;
		this._export_resolver = export_resolver;
		const name_collector = new TypeScriptCompositionNameCollector(source_file);
		name_collector.collect();
		this._dependency_collector = new TypeScriptConstructorDependencies(name_collector.class_names());
	}

	/** Responsibilities: _local imports collection_. **/
	public imports(): Map<string, ImportedSymbol> {
		const imports = new Map<string, ImportedSymbol>();
		for (const statement of this._source_file.statements) {
			if (ts.isImportDeclaration(statement)) {
				this.add_import(statement, imports);
			}
		}
		return imports;
	}

	/** Responsibilities: _source classes collection_. **/
	public classes(): CodeClass[] {
		return this._source_file.statements.flatMap((statement) => this.classes_from_statement(statement));
	}
}
