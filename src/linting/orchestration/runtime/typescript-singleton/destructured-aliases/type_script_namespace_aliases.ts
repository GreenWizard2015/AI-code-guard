import { TypeScriptExpressionNames } from "src/parser/typescript-aliases/type_script_expression_names";
import type { ExpressionNamesContract } from "src/runtime_protocols";
import type { TypeScriptNamespaceAliasesContract } from "src/typescript_runtime_protocols";
import ts from "typescript";

/** Responsibilities: _namespace import collection_, _qualified target resolution_. **/
export class TypeScriptNamespaceAliases implements TypeScriptNamespaceAliasesContract {
	private readonly _expression_names: ExpressionNamesContract;
	private readonly _source_file: ts.SourceFile;

	/** Responsibilities: _resolution namespace member target_. **/
	private member_target(expression: ts.Node): string {
		if (ts.isPropertyAccessExpression(expression)) {
			return expression.name.text;
		}
		if (!ts.isElementAccessExpression(expression)) {
			return "";
		}
		const argument = expression.argumentExpression;
		if (argument === undefined) {
			return "";
		}
		const key = this._expression_names.unwrap_transparent_expression(argument);
		if (!ts.isStringLiteral(key) && !ts.isNoSubstitutionTemplateLiteral(key)) {
			return "";
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
		for (const statement of this._source_file.statements) {
			visit(statement);
		}
		return declarations;
	}

	/** Responsibilities: _namespace alias identification_. **/
	private append_variable_alias(names: Set<string>, declaration: ts.VariableDeclaration): boolean {
		if (!ts.isIdentifier(declaration.name)) {
			return false;
		}
		if (declaration.initializer === undefined) {
			return false;
		}
		const initializer = this._expression_names.unwrap_transparent_expression(declaration.initializer);
		if (!ts.isIdentifier(initializer)) {
			return false;
		}
		if (!names.has(initializer.text) || names.has(declaration.name.text)) {
			return false;
		}
		names.add(declaration.name.text);
		return true;
	}

	/** Responsibilities: _namespace import names_. **/
	private imported_names(): Set<string> {
		const names = new Set<string>();
		for (const statement of this._source_file.statements) {
			if (!ts.isImportDeclaration(statement)) {
				continue;
			}
			const import_clause = statement.importClause;
			if (import_clause === undefined) {
				continue;
			}
			const bindings = import_clause.namedBindings;
			if (bindings && ts.isNamespaceImport(bindings)) {
				names.add(bindings.name.text);
			}
		}
		return names;
	}

	/** Responsibilities: _initialization namespace alias source_. **/
	public constructor(source_file: ts.SourceFile) {
		this._expression_names = new TypeScriptExpressionNames();
		this._source_file = source_file;
	}

	/** Responsibilities: _collection namespace import names_. **/
	public names(): ReadonlySet<string> {
		const names = this.imported_names();
		const declarations = this.variable_declarations();
		let changed = true;
		while (changed) {
			changed = false;
			for (const declaration of declarations) {
				if (this.append_variable_alias(names, declaration)) {
					changed = true;
				}
			}
		}
		return names;
	}

	/** Responsibilities: _resolution namespace property target_. **/
	public target(initializer: ts.Expression): string {
		const expression = this._expression_names.unwrap_transparent_expression(initializer);
		if (!ts.isPropertyAccessExpression(expression) && !ts.isElementAccessExpression(expression)) {
			return "";
		}
		if (!ts.isIdentifier(expression.expression) || !this.names().has(expression.expression.text)) {
			return "";
		}
		return this.member_target(expression);
	}
}
