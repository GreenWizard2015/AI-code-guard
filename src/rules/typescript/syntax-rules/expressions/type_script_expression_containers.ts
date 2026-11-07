import type { TypeScriptExpressionContainersContract } from "src/typescript_analysis_protocols";
import ts from "typescript";

/** Responsibilities: _expression boundary classification_, _nested expression lookup_. **/
export class TypeScriptExpressionContainers implements TypeScriptExpressionContainersContract {
	private readonly _container_kinds: Set<ts.SyntaxKind>;
	private readonly _nested_cache: WeakMap<ts.Node, boolean>;

	/** Responsibilities: _binary expression containment_. **/
	private binary(binary_parent: ts.Node, binary_child: ts.Node): boolean {
		if (!ts.isBinaryExpression(binary_parent)) {
			return false;
		}
		if (binary_parent.left === binary_child) {
			return true;
		}
		return binary_parent.right === binary_child;
	}

	/** Responsibilities: _argument containment_. **/
	private argument_list(call_expression: ts.CallExpression, argument_candidate: ts.Node): boolean {
		if (call_expression.expression === argument_candidate) {
			return true;
		}
		return call_expression.arguments.some((argument) => argument === argument_candidate);
	}

	/** Responsibilities: _access expression containment_. **/
	private access(access_expression: ts.Node, accessed_child: ts.Node): boolean {
		if (ts.isPropertyAccessExpression(access_expression)) {
			return access_expression.expression === accessed_child;
		}
		if (ts.isElementAccessExpression(access_expression)) {
			if (access_expression.expression === accessed_child) {
				return true;
			}
			return access_expression.argumentExpression === accessed_child;
		}
		return false;
	}

	/** Responsibilities: _conditional expression containment_. **/
	private conditional(conditional_expression: ts.ConditionalExpression, branch_expression: ts.Node): boolean {
		if (conditional_expression.condition === branch_expression) {
			return true;
		}
		if (conditional_expression.whenTrue === branch_expression) {
			return true;
		}
		return conditional_expression.whenFalse === branch_expression;
	}

	/** Responsibilities: _simple unary containment_. **/
	private simple_unary(unary_expression: ts.Node, unary_operand: ts.Node): boolean {
		if (ts.isAwaitExpression(unary_expression)) {
			return unary_expression.expression === unary_operand;
		}
		if (ts.isVoidExpression(unary_expression)) {
			return unary_expression.expression === unary_operand;
		}
		if (ts.isNonNullExpression(unary_expression)) {
			return unary_expression.expression === unary_operand;
		}
		if (ts.isPrefixUnaryExpression(unary_expression)) {
			return unary_expression.operand === unary_operand;
		}
		return false;
	}

	/** Responsibilities: _assertion containment_. **/
	private assertion_expression(assertion: ts.Node, asserted_expression: ts.Node): boolean {
		if (ts.isAsExpression(assertion)) {
			return assertion.expression === asserted_expression;
		}
		if (ts.isTypeAssertionExpression(assertion)) {
			return assertion.expression === asserted_expression;
		}
		if (ts.isSatisfiesExpression(assertion)) {
			return assertion.expression === asserted_expression;
		}
		return false;
	}

	/** Responsibilities: _unary containment_. **/
	private unary_expression(unary_container: ts.Node, nested_expression: ts.Node): boolean {
		if (this.simple_unary(unary_container, nested_expression)) {
			return true;
		}
		return this.assertion_expression(unary_container, nested_expression);
	}

	/** Responsibilities: _literal containment_. **/
	private literal(literal_container: ts.Node, literal_child: ts.Node): boolean {
		if (ts.isPropertyAssignment(literal_container)) {
			return literal_container.initializer === literal_child;
		}
		if (ts.isShorthandPropertyAssignment(literal_container)) {
			return literal_container.name === literal_child;
		}
		return this.collection_literal(literal_container, literal_child);
	}

	/** Responsibilities: _collection literal containment_. **/
	private collection_literal(literal: ts.Node, literal_child: ts.Node): boolean {
		if (ts.isObjectLiteralExpression(literal)) {
			return literal.properties.some((property) => property === literal_child);
		}
		if (ts.isArrayLiteralExpression(literal)) {
			return literal.elements.some((element) => element === literal_child);
		}
		if (ts.isSpreadElement(literal)) {
			return literal.expression === literal_child;
		}
		if (ts.isSpreadAssignment(literal)) {
			return literal.expression === literal_child;
		}
		return false;
	}

	/** Responsibilities: _template expression containment_. **/
	private template(template_container: ts.Node, template_child: ts.Node): boolean {
		if (ts.isTemplateSpan(template_container)) {
			return template_container.expression === template_child;
		}
		if (ts.isTemplateExpression(template_container)) {
			return template_container.templateSpans.some((span) => span === template_child);
		}
		if (ts.isTaggedTemplateExpression(template_container)) {
			if (template_container.tag === template_child) {
				return true;
			}
			return template_container.template === template_child;
		}
		return false;
	}

	/** Responsibilities: _expression containment_. **/
	private expression(expression_container: ts.Node, child_expression: ts.Node): boolean {
		if (this.template(expression_container, child_expression)) {
			return true;
		}
		if (ts.isCallExpression(expression_container)) {
			return this.argument_list(expression_container, child_expression);
		}
		if (ts.isNewExpression(expression_container)) {
			return this.new_expression(expression_container, child_expression);
		}
		if (this.access(expression_container, child_expression)) {
			return true;
		}
		if (ts.isConditionalExpression(expression_container)) {
			return this.conditional(expression_container, child_expression);
		}
		return this.unary_expression(expression_container, child_expression);
	}

	/** Responsibilities: _constructor expression containment_. **/
	private new_expression(construction: ts.NewExpression, construction_child: ts.Node): boolean {
		if (construction.expression === construction_child) {
			return true;
		}
		return construction.arguments?.some((argument) => argument === construction_child) === true;
	}

	/** Responsibilities: _nested container_. **/
	/** Responsibilities: _field initialization_. **/
	public constructor() {
		this._nested_cache = new WeakMap<ts.Node, boolean>();
		this._container_kinds = new Set([
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
	public nested(candidate: ts.Node): boolean {
		const cached = this._nested_cache.get(candidate);
		if (cached !== undefined) {
			return cached;
		}
		const nested = this._container_kinds.has(candidate.kind) && candidate.parent !== undefined;
		this._nested_cache.set(candidate, nested);
		return nested;
	}

	/** Responsibilities: _expression containment_. **/
	public contains(parent_container: ts.Node, nested_node: ts.Node): boolean {
		if (!this.nested(parent_container)) {
			return false;
		}
		if (ts.isParenthesizedExpression(parent_container)) {
			return true;
		}
		if (this.binary(parent_container, nested_node)) {
			return true;
		}
		if (this.literal(parent_container, nested_node)) {
			return true;
		}
		return this.expression(parent_container, nested_node);
	}
}
