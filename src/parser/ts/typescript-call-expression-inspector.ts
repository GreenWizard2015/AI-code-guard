import ts from 'typescript';

/** Responsibilities: _unwrap TypeScript invocation expressions_. **/
export class TypeScriptCallExpressionInspector {
	private readonly bind_method_name = 'bind';

	/** Responsibilities: _unwrap nested bind invocation_. **/
	private unwrap_bind_context(expression: ts.Expression): ts.Expression[] {
		let current = expression;
		while (ts.isSatisfiesExpression(current)) {
			current = current.expression;
		}
		return [current];
	}

	/** Responsibilities: _classification invocation expression usage_. **/
	private has_bind_context(node: ts.CallExpression): boolean {
		if (node.arguments.length === 0) {
			return false;
		}
		const argument = node.arguments[0];
		const contexts = this.unwrap_bind_context(argument);
		if (contexts.length === 0) {
			return false;
		}
		const context = contexts[0];
return !ts.isObjectLiteralExpression(context) && !ts.isArrayLiteralExpression(context);
	}

	/** Responsibilities: _resolution source expression represented_. **/
	private bind_source(
		expression: ts.Expression
	): ts.Node[] {
if (ts.isIdentifier(expression) || ts.isPropertyAccessExpression(expression)) {
			return [expression];
		}
		return [];
	}

	/** Responsibilities: _resolution direct values declared_. **/
	private declaration_value(
		node: ts.Node
	): ts.Expression[] {
		if (!ts.isVariableDeclaration(node) && !ts.isParameter(node)) {
			return [];
		}
		if (node.initializer !== undefined) {
			return [node.initializer];
		}
		return [];
	}

	/** Responsibilities: _resolution expressions output output_. **/
	private return_value(node: ts.ReturnStatement): ts.Expression[] {
		if (node.expression !== undefined) {
			return [node.expression];
		}
		return [];
	}

	/** Responsibilities: _collection direct value expressions_. **/
	public direct_value_expression(node: ts.Node): ts.Expression[] {
		if (ts.isPropertyAssignment(node)) {
			return [node.initializer];
		}
		if (ts.isVariableDeclaration(node) || ts.isParameter(node)) {
			return this.declaration_value(node);
		}
		if (ts.isReturnStatement(node)) {
			return this.return_value(node);
		}
		if (ts.isBinaryExpression(node)) {
			return [node.right];
		}
		return [];
	}

	/** Responsibilities: _resolution target callable expression_. **/
	public bind_target(
		node: ts.CallExpression
	): ts.Node[] {
		const expression = node.expression;
if (!ts.isPropertyAccessExpression(expression) || expression.name.text !== this.bind_method_name) {
			return [];
		}
		if (!this.has_bind_context(node)) {
			return [];
		}
		return this.bind_source(expression.expression);
	}
}
