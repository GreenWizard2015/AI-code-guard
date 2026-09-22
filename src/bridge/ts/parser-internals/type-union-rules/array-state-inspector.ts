import ts from 'typescript';

/** Responsibilities: _array result detection_. **/
export class TypeScriptArrayStateInspector {
	private readonly array_type_names = new Set(['Array', 'ReadonlyArray']);
	/** Responsibilities: _resolution invocation function name_. **/
	private call_name(call: ts.CallExpression): string {
		if (ts.isIdentifier(call.expression)) {
			return call.expression.text;
		}
		if (ts.isPropertyAccessExpression(call.expression)) {
			return call.expression.name.text;
		}
		return '';
	}

	/** Responsibilities: _aggregation methods named class_. **/
	private append_class_methods(statement: ts.Statement, name: string, declarations: ts.FunctionLikeDeclaration[]): void {
		if (!ts.isClassLike(statement)) {
			return;
		}
		for (const member of statement.members) {
			if (ts.isMethodDeclaration(member) && member.name?.getText() === name) {
				declarations.push(member);
			}
		}
	}

	/** Responsibilities: _aggregation top-level functions class_. **/
	private append_statement_callables(statement: ts.Statement, name: string, declarations: ts.FunctionLikeDeclaration[]): void {
		if (ts.isFunctionDeclaration(statement) && statement.name?.text === name) {
			declarations.push(statement);
		}
		if (!ts.isVariableStatement(statement)) {
			this.append_class_methods(statement, name, declarations);
			return;
		}
		for (const declaration of statement.declarationList.declarations) {
			if (!ts.isIdentifier(declaration.name) || declaration.name.text !== name) {
				continue;
			}
			const initializer = declaration.initializer;
			if (initializer !== undefined && (ts.isArrowFunction(initializer) || ts.isFunctionExpression(initializer))) {
				declarations.push(initializer);
			}
		}
	}

	/** Responsibilities: _collection callable declarations matching_. **/
	private callable_declarations(source_file: ts.SourceFile, name: string): ts.FunctionLikeDeclaration[] {
		const declarations: ts.FunctionLikeDeclaration[] = [];
		for (const statement of source_file.statements) {
			this.append_statement_callables(statement, name, declarations);
		}
		return declarations;
	}

	/** Responsibilities: _classification callable output array_. **/
	private array_return_type(callable: ts.FunctionLikeDeclaration): boolean {
		const type = callable.type;
		if (type === undefined || ts.isArrayTypeNode(type)) {
			return type !== undefined;
		}
		if (!ts.isTypeReferenceNode(type) || !ts.isIdentifier(type.typeName)) {
			return false;
		}
		return this.array_type_names.has(type.typeName.text);
	}

	/** Responsibilities: _collection expressions output callable_. **/
	private returned_expressions(body: ts.Block): ts.Expression[] {
		const returns: ts.Expression[] = [];
		const visit = (node: ts.Node): void => {
			if (ts.isReturnStatement(node)) {
				if (node.expression !== undefined) {
					returns.push(node.expression);
				}
				return;
			}
			if (ts.isFunctionLike(node)) {
				return;
			}
			ts.forEachChild(node, visit);
		};
		visit(body);
		return returns;
	}

	/** Responsibilities: _classification every output array_. **/
	private single_item_returns(callable: ts.FunctionLikeDeclaration): boolean {
		const body = callable.body;
		if (body === undefined) {
			return false;
		}
		if (!ts.isBlock(body)) {
			return ts.isArrayLiteralExpression(body) && body.elements.length <= 1;
		}
		const returns = this.returned_expressions(body);
		if (returns.length === 0) {
			return false;
		}
		return returns.every(expression => this.single_item_array(expression));
	}

	/** Responsibilities: _classification single-item array expression_. **/
	private single_item_array(expression: ts.Expression): boolean {
		if (!ts.isArrayLiteralExpression(expression)) {
			return false;
		}
		return expression.elements.length <= 1;
	}

	/** Responsibilities: _reporting indexing access known_. **/
	public single_item_access(node: ts.ElementAccessExpression, source_file: ts.SourceFile): boolean {
		if (!ts.isCallExpression(node.expression)) {
			return false;
		}
		const name = this.call_name(node.expression);
		if (name.length === 0) {
			return false;
		}
		return this.callable_declarations(source_file, name).some(callable =>
			this.single_item_callable(callable)
		);
	}

	/** Responsibilities: _reporting callable whose array_. **/
	public single_item_callable(callable: ts.FunctionLikeDeclaration): boolean {
		if (!this.array_return_type(callable)) {
			return false;
		}
		return this.single_item_returns(callable);
	}
}
