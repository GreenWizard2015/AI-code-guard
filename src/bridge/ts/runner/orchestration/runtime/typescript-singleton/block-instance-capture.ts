import ts from "typescript";

/** Responsibilities: _TypeScript block instance ownership_. **/
export class TypeScriptBlockInstanceCapture {
	private readonly source_file: ts.SourceFile;

	/** Responsibilities: _variable declarations_. **/
	private append_variable_declarations(node: ts.Node, declarations: ts.VariableDeclaration[]): void {
		if (ts.isFunctionLike(node) || ts.isClassLike(node)) {
			return;
		}
		if (ts.isVariableStatement(node)) {
			declarations.push(...node.declarationList.declarations);
			return;
		}
		if (ts.isVariableDeclarationList(node)) {
			declarations.push(...node.declarations);
			return;
		}
		ts.forEachChild(node, (child) => this.append_variable_declarations(child, declarations));
	}

	/** Responsibilities: _name occurrence_. **/
	private references_name(node: ts.Node, name: string): boolean {
		let found = false;
		const visit = (child: ts.Node): void => {
			if (found) {
				return;
			}
			if (ts.isIdentifier(child)) {
				if (child.text === name) {
					found = true;
					return;
				}
			}
			ts.forEachChild(child, visit);
		};
		visit(node);
		return found;
	}

	/** Responsibilities: _module assignment target_. **/
	private escaping_function(node: ts.Node, names: ReadonlySet<string>): boolean {
		if (node.getSourceFile() !== this.source_file) {
			return false;
		}
		const parent = node.parent;
		if (!ts.isBinaryExpression(parent)) {
			return false;
		}
		if (parent.operatorToken.kind !== ts.SyntaxKind.EqualsToken) {
			return false;
		}
		if (!ts.isIdentifier(parent.left)) {
			return false;
		}
		return names.has(parent.left.text);
	}

	/** Responsibilities: _function ownership_. **/
	private function_ownership(node: ts.Node, name: string, names: ReadonlySet<string>): boolean {
		if (ts.isArrowFunction(node)) {
			return this.escaping_body(node, node.body, name, names);
		}
		if (ts.isFunctionExpression(node)) {
			return this.escaping_body(node, node.body, name, names);
		}
		if (ts.isFunctionDeclaration(node)) {
			if (node.body !== undefined) {
				return this.escaping_body(node, node.body, name, names);
			}
		}
		if (ts.isMethodDeclaration(node)) {
			if (node.body !== undefined) {
				return this.escaping_body(node, node.body, name, names);
			}
		}
		return false;
	}

	/** Responsibilities: _function body scope_. **/
	private escaping_body(function_node: ts.Node, body: ts.Node, name: string, names: ReadonlySet<string>): boolean {
		if (!this.references_name(body, name)) {
			return false;
		}
		return this.escaping_function(function_node, names);
	}

	/** Responsibilities: _block instance ownership_. **/
	private escaping_block_variable(
		block: ts.Block,
		declaration: ts.VariableDeclaration,
		names: ReadonlySet<string>,
	): boolean {
		if (!ts.isIdentifier(declaration.name)) {
			return false;
		}
		const name = declaration.name.text;
		let escaped = false;
		const visit = (node: ts.Node): void => {
			if (escaped) {
				return;
			}
			if (ts.isFunctionLike(node)) {
				if (this.function_ownership(node, name, names)) {
					escaped = true;
				}
				return;
			}
			ts.forEachChild(node, visit);
		};
		visit(block);
		return escaped;
	}

	/** Responsibilities: _block source initialization_. **/
	public constructor(source_file: ts.SourceFile) {
		this.source_file = source_file;
	}

	/** Responsibilities: _module variable declarations_. **/
	public module_variables(statements: readonly ts.Statement[]): ts.VariableDeclaration[] {
		const declarations: ts.VariableDeclaration[] = [];
		for (const statement of statements) {
			if (!ts.isBlock(statement)) {
				this.append_variable_declarations(statement, declarations);
			}
		}
		return declarations;
	}

	/** Responsibilities: _module variable names_. **/
	public module_variable_names(declarations: readonly ts.VariableDeclaration[]): ReadonlySet<string> {
		const names = new Set<string>();
		for (const declaration of declarations) {
			if (ts.isIdentifier(declaration.name)) {
				names.add(declaration.name.text);
			}
		}
		return names;
	}

	/** Responsibilities: _block instance variables_. **/
	public escaped_variables(block: ts.Block, names: ReadonlySet<string>): ts.VariableDeclaration[] {
		const declarations: ts.VariableDeclaration[] = [];
		this.append_variable_declarations(block, declarations);
		return declarations.filter((declaration) => {
			if (declaration.initializer === undefined) {
				return false;
			}
			return this.escaping_block_variable(block, declaration, names);
		});
	}
}
