import ts from 'typescript';
import { unwrap_transparent_expression } from 'functions';

/** Responsibilities: _resolution namespace import aliases_. **/
export class TypeScriptNamespaceAliases {
	private readonly source_file: ts.SourceFile;

	/** Responsibilities: _resolution namespace member target_. **/
	private member_target(expression: ts.Node): string {
		if (ts.isPropertyAccessExpression(expression)) {
			return expression.name.text;
		}
		if (!ts.isElementAccessExpression(expression)) {
			return '';
		}
		const argument = expression.argumentExpression;
		if (argument === undefined) {
			return '';
		}
		const key = unwrap_transparent_expression(argument);
		if (!ts.isStringLiteral(key) && !ts.isNoSubstitutionTemplateLiteral(key)) {
			return '';
		}
		return key.text;
	}

	/** Responsibilities: _collection namespace alias declarations_. **/
	private variable_declarations(): readonly ts.VariableDeclaration[] {
		const declarations: ts.VariableDeclaration[] = [];
		const visit = (node: ts.Node): void => {
			if (ts.isFunctionLike(node) || ts.isClassLike(node)) {
				return;
			}
			if (ts.isVariableDeclaration(node)) {
				declarations.push(node);
				return;
			}
			ts.forEachChild(node, visit);
		};
		for (const statement of this.source_file.statements) {
			visit(statement);
		}
		return declarations;
	}

	/** Responsibilities: _collection namespace imports_. **/
	private append_import_names(names: Set<string>): void {
		for (const statement of this.source_file.statements) {
			if (!ts.isImportDeclaration(statement)) {
				continue;
			}
			const bindings = statement.importClause?.namedBindings;
			if (bindings && ts.isNamespaceImport(bindings)) {
				names.add(bindings.name.text);
			}
		}
	}

	/** Responsibilities: _namespace alias identification_. **/
	private append_variable_alias(names: Set<string>, declaration: ts.VariableDeclaration): boolean {
		if (!ts.isIdentifier(declaration.name) || declaration.initializer === undefined) {
			return false;
		}
		const initializer = unwrap_transparent_expression(declaration.initializer);
		if (!ts.isIdentifier(initializer)) {
			return false;
		}
		if (!names.has(initializer.text) || names.has(declaration.name.text)) {
			return false;
		}
		names.add(declaration.name.text);
		return true;
	}

	/** Responsibilities: _collection namespace aliases_. **/
	private append_variable_aliases(names: Set<string>): void {
		let changed = true;
		while (changed) {
			changed = false;
			for (const declaration of this.variable_declarations()) {
				if (this.append_variable_alias(names, declaration)) {
					changed = true;
				}
			}
		}
	}

	/** Responsibilities: _initialization namespace alias source_. **/
	public constructor(source_file: ts.SourceFile) {
		this.source_file = source_file;
	}

	/** Responsibilities: _collection namespace import names_. **/
	public names(): ReadonlySet<string> {
		const names = new Set<string>();
		this.append_import_names(names);
		this.append_variable_aliases(names);
		return names;
	}

	/** Responsibilities: _resolution namespace property target_. **/
	public target(initializer: ts.Expression): string {
		const expression = unwrap_transparent_expression(initializer);
		if (!ts.isPropertyAccessExpression(expression) && !ts.isElementAccessExpression(expression)) {
			return '';
		}
		if (!ts.isIdentifier(expression.expression) || !this.names().has(expression.expression.text)) {
			return '';
		}
		return this.member_target(expression);
	}

}
