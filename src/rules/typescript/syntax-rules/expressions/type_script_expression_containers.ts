import ts from "typescript";

/** Responsibilities: _expression boundary classification_, _nested expression lookup_. **/
export class TypeScriptExpressionContainers {
	private readonly container_kinds: Set<ts.SyntaxKind>;

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

	/** Responsibilities: _simple unary containment_. **/
	private simple_unary(container: ts.Node, current: ts.Node): boolean {
		if (ts.isAwaitExpression(container)) {
			return container.expression === current;
		}
		if (ts.isVoidExpression(container)) {
			return container.expression === current;
		}
		if (ts.isNonNullExpression(container)) {
			return container.expression === current;
		}
		if (ts.isPrefixUnaryExpression(container)) {
			return container.operand === current;
		}
		return false;
	}

	/** Responsibilities: _assertion containment_. **/
	private assertion_expression(container: ts.Node, current: ts.Node): boolean {
		if (ts.isAsExpression(container)) {
			return container.expression === current;
		}
		if (ts.isTypeAssertionExpression(container)) {
			return container.expression === current;
		}
		if (ts.isSatisfiesExpression(container)) {
			return container.expression === current;
		}
		return false;
	}

	/** Responsibilities: _unary containment_. **/
	private unary_expression(container: ts.Node, current: ts.Node): boolean {
		if (this.simple_unary(container, current)) {
			return true;
		}
		return this.assertion_expression(container, current);
	}

	/** Responsibilities: _literal containment_. **/
	private literal(container: ts.Node, current: ts.Node): boolean {
		if (ts.isPropertyAssignment(container)) {
			return container.initializer === current;
		}
		if (ts.isShorthandPropertyAssignment(container)) {
			return container.name === current;
		}
		return this.collection_literal(container, current);
	}

	/** Responsibilities: _collection literal containment_. **/
	private collection_literal(container: ts.Node, current: ts.Node): boolean {
		if (ts.isObjectLiteralExpression(container)) {
			return container.properties.some((property) => property === current);
		}
		if (ts.isArrayLiteralExpression(container)) {
			return container.elements.some((element) => element === current);
		}
		if (ts.isSpreadElement(container)) {
			return container.expression === current;
		}
		if (ts.isSpreadAssignment(container)) {
			return container.expression === current;
		}
		return false;
	}

	/** Responsibilities: _template expression containment_. **/
	private template(container: ts.Node, current: ts.Node): boolean {
		if (ts.isTemplateSpan(container)) {
			return container.expression === current;
		}
		if (ts.isTemplateExpression(container)) {
			return container.templateSpans.some((span) => span === current);
		}
		if (ts.isTaggedTemplateExpression(container)) {
			return container.tag === current || container.template === current;
		}
		return false;
	}

	/** Responsibilities: _expression containment_. **/
	private expression(container: ts.Node, current: ts.Node): boolean {
		if (this.template(container, current)) {
			return true;
		}
		if (ts.isCallExpression(container)) {
			return this.argument_list(container, current);
		}
		if (ts.isNewExpression(container)) {
			return this.new_expression(container, current);
		}
		if (this.access(container, current)) {
			return true;
		}
		if (ts.isConditionalExpression(container)) {
			return this.conditional(container, current);
		}
		return this.unary_expression(container, current);
	}

	/** Responsibilities: _constructor expression containment_. **/
	private new_expression(container: ts.NewExpression, current: ts.Node): boolean {
		if (container.expression === current) {
			return true;
		}
		return container.arguments?.some((argument) => argument === current) === true;
	}

	/** Responsibilities: _nested container_. **/
	/** Responsibilities: _field initialization_. **/
	constructor() {
		this.container_kinds = new Set([
			ts.SyntaxKind.ParenthesizedExpression,
			ts.SyntaxKind.BinaryExpression,
			ts.SyntaxKind.PropertyAssignment,
			ts.SyntaxKind.ShorthandPropertyAssignment,
			ts.SyntaxKind.ObjectLiteralExpression,
			ts.SyntaxKind.ArrayLiteralExpression,
			ts.SyntaxKind.SpreadElement,
			ts.SyntaxKind.SpreadAssignment,
			ts.SyntaxKind.CallExpression,
			ts.SyntaxKind.PropertyAccessExpression,
			ts.SyntaxKind.ElementAccessExpression,
			ts.SyntaxKind.ConditionalExpression,
			ts.SyntaxKind.AwaitExpression,
			ts.SyntaxKind.PrefixUnaryExpression,
			ts.SyntaxKind.VoidExpression,
			ts.SyntaxKind.NonNullExpression,
			ts.SyntaxKind.AsExpression,
			ts.SyntaxKind.TypeAssertionExpression,
			ts.SyntaxKind.SatisfiesExpression,
			ts.SyntaxKind.TemplateSpan,
			ts.SyntaxKind.TemplateExpression,
			ts.SyntaxKind.TaggedTemplateExpression,
			ts.SyntaxKind.NewExpression,
		]);
	}
	/** Responsibilities: _public operation_. **/
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
