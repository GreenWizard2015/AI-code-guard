import ts from 'typescript';

/** Responsibilities: _classification console mocks assignments_. **/
export class ConsoleMock {
	private readonly mock_methods = new Set(['spyOn', 'stub']);
	private readonly assignment_methods = new Set(['fn', 'mock']);

	/** Responsibilities: _classification invocation invokes configuration_. **/
	private is_mock_call(node: ts.CallExpression): boolean {
		if (!ts.isPropertyAccessExpression(node.expression)) {
			return false;
		}
		const method = node.expression.name.text;
		if (!this.mock_methods.has(method)) {
			return false;
		}
		if (node.arguments.length === 0) {
			return false;
		}
		return this.console_expression(node.arguments[0]);
	}

	/** Responsibilities: _classification assignment targets console_. **/
	private console_assignment(node: ts.BinaryExpression): boolean {
		if (node.operatorToken.kind !== ts.SyntaxKind.EqualsToken) {
			return false;
		}
		if (!this.console_assignment_target(node.left)) {
			return false;
		}
		return this.assignment_value_allowed(node.right);
	}

	/** Responsibilities: _classification left-hand side console_. **/
	private console_assignment_target(node: ts.Expression): boolean {
		if (!ts.isPropertyAccessExpression(node)) {
			return false;
		}
		return this.console_expression(node.expression);
	}

	/** Responsibilities: _classification console assignment value_. **/
	private assignment_value_allowed(node: ts.Expression): boolean {
		if (!ts.isCallExpression(node)) {
			return false;
		}
		if (!ts.isPropertyAccessExpression(node.expression)) {
			return false;
		}
		return this.assignment_methods.has(node.expression.name.text);
	}

	/** Responsibilities: _classification node accesses console_. **/
	private is_console_property(node: ts.Node): boolean {
		if (!ts.isPropertyAccessExpression(node)) {
			return false;
		}
		return this.console_expression(node.expression);
	}

	/** Responsibilities: _classification console property assignment_. **/
	private console_usage_assignment(node: ts.Node): boolean {
		if (!ts.isBinaryExpression(node)) {
			return false;
		}
		if (!ts.isPropertyAccessExpression(node.left)) {
			return false;
		}
		return this.console_expression(node.left.expression);
	}

	/** Responsibilities: _reporting expression valid console_. **/
	public console_expression(node: ts.Expression): boolean {
		if (ts.isIdentifier(node)) {
			return node.text === 'console';
		}
		if (!ts.isPropertyAccessExpression(node)) {
			return false;
		}
		if (!ts.isIdentifier(node.expression)) {
			return false;
		}
		if (node.expression.text !== 'globalThis') {
			return false;
		}
		return node.name.text === 'console';
	}

	/** Responsibilities: _reporting node defines console_. **/
	public console_mock(node: ts.Node): boolean {
		if (ts.isCallExpression(node)) {
			return this.is_mock_call(node);
		}
		if (!ts.isBinaryExpression(node)) {
			return false;
		}
		return this.console_assignment(node);
	}

	/** Responsibilities: _reporting node performs disallowed_. **/
	public console_usage(node: ts.Node): boolean {
		if (ts.isCallExpression(node)) {
			return this.is_console_property(node.expression);
		}
		return this.console_usage_assignment(node);
	}

}
