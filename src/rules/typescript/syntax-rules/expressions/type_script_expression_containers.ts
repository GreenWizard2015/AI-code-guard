import { TypeScriptExpressionOperatorContainment } from "src/rules/typescript/syntax-rules/expressions/type_script_expression_operator_containment";
import type { TypeScriptExpressionContainersContract } from "src/typescript_analysis_protocols";
import ts from "typescript";

/** Responsibilities: _expression boundary classification_, _nested expression lookup_. **/
export class TypeScriptExpressionContainers implements TypeScriptExpressionContainersContract {
	private readonly _container_kinds: Set<ts.SyntaxKind>;
	private readonly _nested_cache: WeakMap<ts.Node, boolean>;
	private readonly _operator_containment: TypeScriptExpressionOperatorContainment;

	/** Responsibilities: _collection member membership_. **/
	private collection_literal(collection: ts.Node, collection_member: ts.Node): boolean {
		if (ts.isObjectLiteralExpression(collection)) {
			return collection.properties.some((property) => property === collection_member);
		}
		if (ts.isArrayLiteralExpression(collection)) {
			return collection.elements.some((element) => element === collection_member);
		}
		if (ts.isSpreadElement(collection) || ts.isSpreadAssignment(collection)) {
			return collection.expression === collection_member;
		}
		return false;
	}

	/** Responsibilities: _literal member containment_. **/
	private literal(literal_node: ts.Node, literal_value: ts.Node): boolean {
		if (ts.isPropertyAssignment(literal_node)) {
			return literal_node.initializer === literal_value;
		}
		if (ts.isShorthandPropertyAssignment(literal_node)) {
			return literal_node.name === literal_value;
		}
		return this.collection_literal(literal_node, literal_value);
	}

	/** Responsibilities: _template expression containment_. **/
	private template(template_node: ts.Node, embedded_expression: ts.Node): boolean {
		if (ts.isTemplateSpan(template_node)) {
			return template_node.expression === embedded_expression;
		}
		if (ts.isTemplateExpression(template_node)) {
			return template_node.templateSpans.some((span) => span === embedded_expression);
		}
		if (ts.isTaggedTemplateExpression(template_node)) {
			return template_node.tag === embedded_expression || template_node.template === embedded_expression;
		}
		return false;
	}

	/** Responsibilities: _expression container initialization_. **/
	public constructor() {
		this._nested_cache = new WeakMap<ts.Node, boolean>();
		this._operator_containment = new TypeScriptExpressionOperatorContainment();
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

	/** Responsibilities: _nested container_. **/
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
		if (this._operator_containment.handles(parent_container)) {
			return this._operator_containment.contains(parent_container, nested_node);
		}
		if (this.literal(parent_container, nested_node)) {
			return true;
		}
		return this.template(parent_container, nested_node);
	}
}
