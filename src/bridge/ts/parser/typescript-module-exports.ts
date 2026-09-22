import ts from 'typescript';
import { TypeScriptImportedFunctionAliases } from 'src/typescript-imported-function-aliases';

/** Responsibilities: _inspection TypeScript exports imports_. **/
export class TypeScriptModuleExports {
	private readonly import_resolver = new TypeScriptImportedFunctionAliases();

	/** Responsibilities: _resolution exported variable declaration_. **/
	private exported_variable(
		statement: ts.VariableStatement,
		exported_name: string
	): ts.VariableDeclaration[] {
		for (const declaration of statement.declarationList.declarations) {
			if (declaration.name.getText(statement.getSourceFile()) === exported_name) {
				return [declaration];
			}
		}
		return [];
	}

	/** Responsibilities: _extraction export modifiers statement_. **/
	private export_modifier(statement: ts.Statement): readonly ts.Modifier[] {
		if (!ts.canHaveModifiers(statement)) {
			return [];
		}
		const modifiers = ts.getModifiers(statement);
		if (modifiers === undefined) {
			return [];
		}
		return modifiers.filter(modifier => modifier.kind === ts.SyntaxKind.ExportKeyword);
	}

	/** Responsibilities: _resolution declaration's explicit output_. **/
	private declaration_return_type(
		declaration: ts.Node
	): ts.TypeNode[] {
		if (ts.isFunctionDeclaration(declaration)) {
			if (declaration.type === undefined) {
				return [];
			}
			return [declaration.type];
		}
		if (!ts.isVariableDeclaration(declaration)) {
			return [];
		}
		const initializer = declaration.initializer;
if (initializer && (ts.isArrowFunction(initializer) || ts.isFunctionExpression(initializer))) {
			if (initializer.type !== undefined) {
				return [initializer.type];
			}
		}
		return [];
	}

	/** Responsibilities: _collection named import bindings_. **/
	public named_imports(statement: ts.Statement): ts.NamedImports[] {
		if (!ts.isImportDeclaration(statement)) {
			return [];
		}
		const bindings = statement.importClause?.namedBindings;
		if (bindings === undefined || !ts.isNamedImports(bindings)) {
			return [];
		}
		return [bindings];
	}

	/** Responsibilities: _resolution source file path_. **/
	public imported_file(source_file: ts.SourceFile, statement: ts.Statement): string {
if (!ts.isImportDeclaration(statement) || !ts.isStringLiteral(statement.moduleSpecifier)) {
			return '';
		}
		const file = this.import_resolver.import_file(source_file, statement.moduleSpecifier.text);
		if (file !== undefined) {
			return file;
		}
		return '';
	}

	/** Responsibilities: _resolution named exported declaration_. **/
	public exported_declaration(
		statement: ts.Statement,
		exported_name: string
	): ts.Node[] {
if (ts.isFunctionDeclaration(statement) && statement.name?.text === exported_name) {
			return [statement];
		}
		if (!ts.isVariableStatement(statement)) {
			return [];
		}
		return this.exported_variable(statement, exported_name);
	}

	/** Responsibilities: _resolution output type named_. **/
	public exported_return_type(
		statement: ts.Statement,
		exported_name: string
	): ts.TypeNode[] {
		const declaration = this.exported_declaration(statement, exported_name);
		if (declaration.length === 0) {
			return [];
		}
		const first_declaration = declaration[0];
		return this.declaration_return_type(first_declaration);
	}

	/** Responsibilities: _reporting export statement_. **/
	public export(statement: ts.Statement): boolean {
		return this.export_modifier(statement).length > 0;
	}
}
