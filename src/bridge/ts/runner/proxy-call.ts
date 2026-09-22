import ts from 'typescript';

/** Responsibilities: _detection callable proxy wrappers_. **/
export class ProxyCall {
	private readonly hidden_visibility_kinds = new Set([
		ts.SyntaxKind.PrivateKeyword,
		ts.SyntaxKind.ProtectedKeyword,
	]);

	/** Responsibilities: _classification declaration supported callable_. **/
	private is_callable_declaration(
		node: ts.Node
	): boolean {
		if (ts.isFunctionDeclaration(node)) {
			return true;
		}
		if (!ts.isMethodDeclaration(node)) {
			return false;
		}
		return !node.modifiers?.some(modifier => this.hidden_visibility_kinds.has(modifier.kind));
	}

	/** Responsibilities: _collection proxy invocation statement_. **/
	private statement_call(statement: ts.Statement): ts.Node[] {
		if (ts.isReturnStatement(statement)) {
			return this.return_statement_call(statement);
		}
		if (ts.isExpressionStatement(statement)) {
			return this.expression_statement_call(statement);
		}
		return [];
	}

	/** Responsibilities: _collection invocation output directly_. **/
	private return_statement_call(statement: ts.ReturnStatement): ts.Node[] {
		const expression = statement.expression;
		if (expression === undefined) {
			return [];
		}
		if (ts.isCallExpression(expression)) {
			return [expression];
		}
		if (ts.isNewExpression(expression)) {
			return [expression];
		}
		if (ts.isPropertyAccessExpression(expression)) {
			return [expression];
		}
		return [];
	}

	/** Responsibilities: _collection invocation output expression_. **/
	private expression_statement_call(statement: ts.ExpressionStatement): ts.Node[] {
		if (ts.isCallExpression(statement.expression)) {
			return [statement.expression];
		}
		if (ts.isNewExpression(statement.expression)) {
			return [statement.expression];
		}
		return [];
	}

	/** Responsibilities: _collection proxy invocation arrow_. **/
	private arrow_call(node: ts.ArrowFunction): ts.Node[] {
		if (ts.isBlock(node.body)) {
			if (node.body.statements.length !== 1) {
				return [];
			}
			return this.statement_call(node.body.statements[0]);
		}
		if (ts.isCallExpression(node.body)) {
			return [node.body];
		}
		if (ts.isNewExpression(node.body) || ts.isPropertyAccessExpression(node.body)) {
			return [node.body];
		}
		return [];
	}

	/** Responsibilities: _collection proxy invocation function_. **/
	private function_call(node: ts.FunctionExpression): ts.Node[] {
		if (node.body.statements.length !== 1) {
			return [];
		}
		return this.statement_call(node.body.statements[0]);
	}

	/** Responsibilities: _collection proxy invocation function-like_. **/
	private declaration_call(node: ts.FunctionLikeDeclaration): ts.Node[] {
		if (node.body === undefined) {
			return [];
		}
		if (!ts.isBlock(node.body)) {
			return [];
		}
		if (node.body.statements.length !== 1) {
			return [];
		}
		return this.statement_call(node.body.statements[0]);
	}

	/** Responsibilities: _classification property access owner_. **/
	private supported_property_owner(owner: ts.Expression): boolean {
		if (owner.kind === ts.SyntaxKind.ThisKeyword) {
			return true;
		}
		if (ts.isPropertyAccessExpression(owner)) {
			return true;
		}
		if (!ts.isIdentifier(owner)) {
			return false;
		}
		if (owner.text[0] === '_') {
			return false;
		}
		return owner.text !== owner.text.toUpperCase();
	}

	/** Responsibilities: _collection proxy invocation nodes_. **/
	public proxy_call(node: ts.Node): ts.Node[] {
		if (ts.isArrowFunction(node)) {
			return this.arrow_call(node);
		}
		if (ts.isFunctionExpression(node)) {
			return this.function_call(node);
		}
		if (ts.isFunctionDeclaration(node)) {
			return this.declaration_call(node);
		}
		if (!ts.isMethodDeclaration(node)) {
			return [];
		}
		if (!this.is_callable_declaration(node)) {
			return [];
		}
		return this.declaration_call(node);
	}

	/** Responsibilities: _reporting expression proxy target_. **/
	public supports_target_expression(expression: ts.Expression): boolean {
		if (ts.isIdentifier(expression)) {
			return true;
		}
		if (!ts.isPropertyAccessExpression(expression)) {
			return false;
		}
		return this.supported_property_owner(expression.expression);
	}

}
