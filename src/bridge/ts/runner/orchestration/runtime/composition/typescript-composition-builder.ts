import ts from 'typescript';

import type { CodeClass, ImportedSymbol } from 'src/types';
import { TypeScriptModuleExports } from 'src/module-resolution/resolver';
import type { LocalImport, TypeScriptComposition } from 'src/bridge/ts/runner/orchestration/runtime/composition/types';

/** Responsibilities: _construction class composition models_. **/
export class TypeScriptCompositionModel {
	private readonly file: string;

	private readonly source_file: ts.SourceFile;
	private readonly export_resolver = new TypeScriptModuleExports();

	/** Responsibilities: _collection classes statement_. **/
	private classes_from_statement(statement: ts.Statement): CodeClass[] {
		if (ts.isClassDeclaration(statement)) {
			return [this.create_class(statement)];
		}
		if (!ts.isVariableStatement(statement)) {
			return [];
		}
		return statement.declarationList.declarations.flatMap(declaration =>
			this.class_from_declaration(declaration)
		);
	}

	/** Responsibilities: _collection class variable declaration_. **/
	private class_from_declaration(declaration: ts.VariableDeclaration): CodeClass[] {
		const initializer = declaration.initializer;
		if (!initializer || !ts.isClassExpression(initializer)) {
			return [];
		}
		return [this.create_class(initializer, declaration.name.getText(this.source_file))];
	}

	/** Responsibilities: _construction class composition record_. **/
	private create_class(node: ts.ClassLikeDeclaration, fallback_name = '<anonymous>'): CodeClass {
		let name = fallback_name;
		if (node.name !== undefined) {
			name = node.name.text;
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
				dependencies.push(...this.field_dependencies(member.initializer));
			}
		}
		return dependencies;
	}

	/** Responsibilities: _collection dependencies field_. **/
	private field_dependencies(node: ts.Node): string[] {
		const dependencies: string[] = [];
if (ts.isNewExpression(node) && ts.isIdentifier(node.expression)) {
			dependencies.push(node.expression.text);
		}
		node.forEachChild(child => dependencies.push(...this.field_dependencies(child)));
		return dependencies;
	}

	/** Responsibilities: _resolution local imports statement_. **/
	private local_import(statement: ts.Statement): LocalImport[] {
		const declarations = this.import_declaration(statement);
		if (declarations.length === 0) {
			return [];
		}
		const import_declaration = declarations[0];
		const clause = import_declaration.importClause;
		if (clause === undefined) {
			return [];
		}
		const file = this.local_import_file(import_declaration);
		if (!file) {
			return [];
		}
		return [{ clause, file }];
	}

	/** Responsibilities: _resolution local import file_. **/
	private local_import_file(node: ts.ImportDeclaration): string {
		const module_specifier = node.moduleSpecifier;
		if (!ts.isStringLiteral(module_specifier)) {
			return '';
		}
		if (!module_specifier.text.startsWith('.')) {
			return '';
		}
		const file = this.export_resolver.module_symbol(this.file, module_specifier.text);
		if (file.length === 0) {
			return '';
		}
		return file;
	}

	/** Responsibilities: _import addition resolution_. **/
	private add_import(statement: ts.Statement, imports: Map<string, ImportedSymbol>): void {
		const resolved_list = this.local_import(statement);
		if (resolved_list.length === 0) {
			return;
		}
		const resolved = resolved_list[0];
		const { clause, file: imported_file } = resolved;
		if (clause.name) {
			imports.set(clause.name.text, this.imported_symbol(imported_file, 'default'));
		}
		this.add_named_imports(clause, imported_file, imports);
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
		imports: Map<string, ImportedSymbol>
	): void {
		if (clause.namedBindings === undefined) {
			return;
		}
		if (!ts.isNamedImports(clause.namedBindings)) {
			return;
		}
		for (const item of clause.namedBindings.elements) {
			const imported_name = this.imported_name(item);
			imports.set(item.name.text, this.imported_symbol(imported_file, imported_name));
		}
	}

	/** Responsibilities: _import declarations identification_. **/
	private import_declaration(statement: ts.Statement): ts.ImportDeclaration[] {
		if (!ts.isImportDeclaration(statement)) {
			return [];
		}
		return [statement];
	}

	/** Responsibilities: _imported name identification_. **/
	private imported_name(item: ts.ImportSpecifier): string {
		if (item.propertyName !== undefined) {
			return item.propertyName.text;
		}
		return item.name.text;
	}

	/** Responsibilities: _composition model state initialization_. **/
	constructor(file: string, text: string, source_file: ts.SourceFile);
	/** Responsibilities: _composition model state initialization_. **/
	constructor(file: string, _text: string, source_file: ts.SourceFile) {
		this.file = file;
		this.source_file = source_file;
	}

	/** Responsibilities: _construction TypeScript composition model_. **/
	public composition(): TypeScriptComposition {
		const imports = this.imports();
		const classes = this.source_file.statements.flatMap(statement =>
			this.classes_from_statement(statement)
		);
		return { classes, imports };
	}

	/** Responsibilities: _local imports exposure resolution_. **/
	public imports(): Map<string, ImportedSymbol> {
		const imports = new Map<string, ImportedSymbol>();
		for (const statement of this.source_file.statements) {
			this.add_import(statement, imports);
		}
		return imports;
	}
}
