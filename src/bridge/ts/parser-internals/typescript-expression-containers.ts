import ts from "typescript";

/** Responsibilities: _classification expression container boundaries_. **/
export class TypeScriptExpressionContainers {
	private readonly container_kinds = new Set([
		ts.SyntaxKind.ParenthesizedExpression,
		ts.SyntaxKind.BinaryExpression,
		ts.SyntaxKind.PropertyAssignment,
		ts.SyntaxKind.ShorthandPropertyAssignment,
		ts.SyntaxKind.ObjectLiteralExpression,
		ts.SyntaxKind.ArrayLiteralExpression,
		ts.SyntaxKind.SpreadElement,
		ts.SyntaxKind.CallExpression,
		ts.SyntaxKind.PropertyAccessExpression,
		ts.SyntaxKind.ElementAccessExpression,
		ts.SyntaxKind.ConditionalExpression,
		ts.SyntaxKind.AwaitExpression,
		ts.SyntaxKind.PrefixUnaryExpression,
		ts.SyntaxKind.NonNullExpression,
		ts.SyntaxKind.AsExpression,
		ts.SyntaxKind.TypeAssertionExpression,
		ts.SyntaxKind.SatisfiesExpression,
	]);

	/** Responsibilities: _binary expression containment_. **/
	private binary(container: ts.Node, current: ts.Node): boolean {
		if (!ts.isBinaryExpression(container)) {
			return false;
		}
		if (container.left === current) {
			return true;
		}
		return container.right === current;
	}

	/** Responsibilities: _argument containment_. **/
	private argument_list(container: ts.CallExpression, current: ts.Node): boolean {
		if (container.expression === current) {
			return true;
		}
		return container.arguments.some((argument) => argument === current);
	}

	/** Responsibilities: _access expression containment_. **/
	private access(container: ts.Node, current: ts.Node): boolean {
		if (ts.isPropertyAccessExpression(container)) {
			return container.expression === current;
		}
		if (ts.isElementAccessExpression(container)) {
			if (container.expression === current) {
				return true;
			}
			return container.argumentExpression === current;
		}
		return false;
	}

	/** Responsibilities: _conditional expression containment_. **/
	private conditional(container: ts.ConditionalExpression, current: ts.Node): boolean {
		if (container.condition === current) {
			return true;
		}
		if (container.whenTrue === current) {
			return true;
		}
		return container.whenFalse === current;
	}

	/** Responsibilities: _unary expression containment_. **/
	private unary(container: ts.Node, current: ts.Node): boolean {
		if (ts.isAwaitExpression(container)) {
			return container.expression === current;
		}
		if (ts.isPrefixUnaryExpression(container)) {
			return container.operand === current;
		}
		if (ts.isNonNullExpression(container)) {
			return container.expression === current;
		}
		if (ts.isAsExpression(container) || ts.isTypeAssertionExpression(container)) {
			return container.expression === current;
		}
		if (ts.isSatisfiesExpression(container)) {
			return container.expression === current;
		}
		return false;
	}

	/** Responsibilities: _literal containment_. **/
	private literal(container: ts.Node, current: ts.Node): boolean {
		if (ts.isPropertyAssignment(container)) {
			return container.initializer === current;
		}
		if (ts.isShorthandPropertyAssignment(container)) {
			return container.name === current;
		}
		if (ts.isObjectLiteralExpression(container)) {
			return container.properties.some((property) => property === current);
		}
		if (ts.isArrayLiteralExpression(container)) {
			return container.elements.some((element) => element === current);
		}
		if (ts.isSpreadElement(container)) {
			return container.expression === current;
		}
		return false;
	}

	/** Responsibilities: _expression containment_. **/
	private expression(container: ts.Node, current: ts.Node): boolean {
		if (ts.isCallExpression(container)) {
			return this.argument_list(container, current);
		}
		if (this.access(container, current)) {
			return true;
		}
		if (ts.isConditionalExpression(container)) {
			return this.conditional(container, current);
		}
		return this.unary(container, current);
	}

	/** Responsibilities: _nested container_. **/
	public nested(node: ts.Node): boolean {
		if (!this.container_kinds.has(node.kind)) {
			return false;
		}
		return node.parent !== undefined;
	}

	/** Responsibilities: _expression containment_. **/
	public contains(container: ts.Node, current: ts.Node): boolean {
		if (!this.nested(container)) {
			return false;
		}
		if (ts.isParenthesizedExpression(container)) {
			return true;
		}
		if (this.binary(container, current)) {
			return true;
		}
		if (this.literal(container, current)) {
			return true;
		}
		return this.expression(container, current);
	}
}
