import ts from "typescript";

/** Responsibilities: _operator child membership_, _operator classification cache_. **/
export class TypeScriptExpressionOperatorContainment {
	private readonly _operator_kinds: ReadonlySet<ts.SyntaxKind>;
	private readonly _operator_cache: WeakMap<ts.Node, boolean>;

	/** Responsibilities: _binary expression containment_. **/
	private binary(binary_expression: ts.Node, operand: ts.Node): boolean {
		if (!ts.isBinaryExpression(binary_expression)) {
			return false;
		}
		return binary_expression.left === operand || binary_expression.right === operand;
	}

	/** Responsibilities: _argument containment_. **/
	private argument_list(call_expression: ts.CallExpression, argument: ts.Node): boolean {
		if (call_expression.expression === argument) {
			return true;
		}
		return call_expression.arguments.some((item) => item === argument);
	}

	/** Responsibilities: _access expression containment_. **/
	private access(access_expression: ts.Node, accessed_part: ts.Node): boolean {
		if (ts.isPropertyAccessExpression(access_expression)) {
			return access_expression.expression === accessed_part;
		}
		if (ts.isElementAccessExpression(access_expression)) {
			return access_expression.expression === accessed_part || access_expression.argumentExpression === accessed_part;
		}
		return false;
	}

	/** Responsibilities: _simple unary containment_. **/
	private simple_unary(unary_expression: ts.Node, operand: ts.Node): boolean {
		if (ts.isAwaitExpression(unary_expression)) {
			return unary_expression.expression === operand;
		}
		if (ts.isVoidExpression(unary_expression)) {
			return unary_expression.expression === operand;
		}
		if (ts.isNonNullExpression(unary_expression)) {
			return unary_expression.expression === operand;
		}
		if (ts.isPrefixUnaryExpression(unary_expression)) {
			return unary_expression.operand === operand;
		}
		return false;
	}

	/** Responsibilities: _assertion containment_. **/
	private assertion(assertion_expression: ts.Node, asserted_value: ts.Node): boolean {
		if (ts.isAsExpression(assertion_expression)) {
			return assertion_expression.expression === asserted_value;
		}
		if (ts.isTypeAssertionExpression(assertion_expression)) {
			return assertion_expression.expression === asserted_value;
		}
		if (ts.isSatisfiesExpression(assertion_expression)) {
			return assertion_expression.expression === asserted_value;
		}
		return false;
	}

	/** Responsibilities: _constructor expression containment_. **/
	private new_expression(construction: ts.NewExpression, construction_part: ts.Node): boolean {
		if (construction.expression === construction_part) {
			return true;
		}
		const arguments_list = construction.arguments;
		if (arguments_list === undefined) {
			return false;
		}
		return arguments_list.some((argument) => argument === construction_part);
	}

	/** Responsibilities: _conditional expression containment_. **/
	private conditional(conditional_expression: ts.ConditionalExpression, branch: ts.Node): boolean {
		if (conditional_expression.condition === branch) {
			return true;
		}
		if (conditional_expression.whenTrue === branch) {
			return true;
		}
		return conditional_expression.whenFalse === branch;
	}

	/** Responsibilities: _compound operator containment_. **/
	private specialized(parent: ts.Node, nested_node: ts.Node): boolean {
		if (this.binary(parent, nested_node) || this.access(parent, nested_node)) {
			return true;
		}
		if (ts.isCallExpression(parent)) {
			return this.argument_list(parent, nested_node);
		}
		if (ts.isNewExpression(parent)) {
			return this.new_expression(parent, nested_node);
		}
		if (ts.isConditionalExpression(parent)) {
			return this.conditional(parent, nested_node);
		}
		return false;
	}

	/** Responsibilities: _operator expression kind registry_. **/
	public constructor() {
		this._operator_cache = new WeakMap();
		this._operator_kinds = new Set([
			ts.SyntaxKind.BinaryExpression,
			ts.SyntaxKind.CallExpression,
			ts.SyntaxKind.NewExpression,
			ts.SyntaxKind.PropertyAccessExpression,
			ts.SyntaxKind.ElementAccessExpression,
			ts.SyntaxKind.ConditionalExpression,
			ts.SyntaxKind.AwaitExpression,
			ts.SyntaxKind.VoidExpression,
			ts.SyntaxKind.NonNullExpression,
			ts.SyntaxKind.PrefixUnaryExpression,
			ts.SyntaxKind.AsExpression,
			ts.SyntaxKind.TypeAssertionExpression,
			ts.SyntaxKind.SatisfiesExpression,
		]);
	}

	/** Responsibilities: _operator expression candidate selection_. **/
	public handles(candidate: ts.Node): boolean {
		const cached = this._operator_cache.get(candidate);
		if (cached !== undefined) {
			return cached;
		}
		const handled = this._operator_kinds.has(candidate.kind);
		this._operator_cache.set(candidate, handled);
		return handled;
	}

	/** Responsibilities: _nested operator membership_. **/
	public contains(parent: ts.Node, nested_node: ts.Node): boolean {
		if (this.specialized(parent, nested_node)) {
			return true;
		}
		return this.simple_unary(parent, nested_node) || this.assertion(parent, nested_node);
	}
}
