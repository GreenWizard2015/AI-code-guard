import { TypeScriptImportedFunctionAliases } from 'src/typescript-imported-function-aliases';
import { readFileSync } from 'node:fs';
import ts from 'typescript';

/** Responsibilities: _resolution imported instance aliases_. **/
export class TypeScriptImportedInstanceAliases {
	private readonly script_target = ts.ScriptTarget.Latest;

	/** Responsibilities: _resolution import source absolute_. **/
	private imported_file_path(
		source_file: ts.SourceFile,
		statement: ts.Statement
	): string {
		const imported_function_aliases = new TypeScriptImportedFunctionAliases();

if (!ts.isImportDeclaration(statement) || !ts.isStringLiteral(statement.moduleSpecifier)) {
			return '';
		}
		const file = imported_function_aliases.import_file(source_file, statement.moduleSpecifier.text);
		if (file !== undefined) {
			return file;
		}
		return '';
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
		instances: Map<string, string>
	): void {
		for (const element of bindings.elements) {
			const owner = this.exported_instance_owner(
				imported_file,
				this.imported_binding_name(element)
			);
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
		const source = readFileSync(file, 'utf8');
		const source_file = ts.createSourceFile(file, source, this.script_target, true);
		const declarations = this.exported_variable(source_file, exported_name);
		for (const declaration of declarations) {
			return this.new_instance_owner(declaration);
		}
		return '';
	}

	/** Responsibilities: _resolution class owner construction_. **/
	private new_instance_owner(declaration: ts.VariableDeclaration): string {
		if (declaration.initializer === undefined) {
			return '';
		}
		if (!ts.isNewExpression(declaration.initializer)) {
			return '';
		}
		if (!ts.isIdentifier(declaration.initializer.expression)) {
			return '';
		}
		return declaration.initializer.expression.text;
	}

	/** Responsibilities: _discovery exported variable declaration_. **/
	private exported_variable(
		source_file: ts.SourceFile,
		exported_name: string
	): ts.VariableDeclaration[] {
		for (const statement of source_file.statements) {
			const declaration = this.exported_variable_in(statement, source_file, exported_name);
			if (declaration.length > 0) {
				return declaration;
			}
		}
		return [];
	}

	/** Responsibilities: _discovery exported variable declaration_. **/
	private exported_variable_in(
		statement: ts.Statement,
		source_file: ts.SourceFile,
		exported_name: string
	): ts.VariableDeclaration[] {
if (!this.has_export_modifier(statement) || !ts.isVariableStatement(statement)) {
			return [];
		}
		const declaration = statement.declarationList.declarations.find(
			item => item.name.getText(source_file) === exported_name
		);
		if (declaration !== undefined) {
			return [declaration];
		}
		return [];
	}

	/** Responsibilities: _classification statement exported_. **/
	private has_export_modifier(statement: ts.Statement): boolean {
		if (!ts.canHaveModifiers(statement)) {
			return false;
		}
		return Boolean(
			ts.getModifiers(statement)?.some(modifier => modifier.kind === ts.SyntaxKind.ExportKeyword)
		);
	}

	/** Responsibilities: _resolution imported instance addition_. **/
	public add_imported_instances(
		source_file: ts.SourceFile,
		statement: ts.Statement,
		instances: Map<string, string>
	): void {
		const named_bindings_list = this.imported_named_bindings(statement);
		if (named_bindings_list.length === 0) {
			return;
		}
		const named_bindings = named_bindings_list[0];
		const imported_file = this.imported_file_path(source_file, statement);
		if (imported_file) {
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
