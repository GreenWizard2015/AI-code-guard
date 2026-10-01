import ts from "typescript";
import { TypeScriptExpressionAliases } from "src/typescript-aliases/typescript-expression-aliases";

/** Responsibilities: _property assignments classification_, _primitive assignments classification_. **/
export class TypeScriptAssignmentPredicates {
	private readonly self_aliases = new TypeScriptExpressionAliases("this");
	private readonly primitive_type_kinds = new Set([
		ts.SyntaxKind.StringKeyword,
		ts.SyntaxKind.NumberKeyword,
		ts.SyntaxKind.BooleanKeyword,
		ts.SyntaxKind.BigIntKeyword,
		ts.SyntaxKind.NullKeyword,
		ts.SyntaxKind.UndefinedKeyword,
	]);

	/** Responsibilities: _identification assignments this properties_. **/
	private is_property_assignment(node: ts.Node): boolean {
		if (!ts.isBinaryExpression(node)) {
			return false;
		}
		if (node.operatorToken.kind !== ts.SyntaxKind.EqualsToken) {
			return false;
		}
		if (!ts.isPropertyAccessExpression(node.left) && !ts.isElementAccessExpression(node.left)) {
			return false;
		}
		return this.self_aliases.receiver(node.left.expression, node);
	}

	/** Responsibilities: _primitive variable annotations identification_. **/
	private is_primitive_type(parent: ts.Node): boolean {
		if (!ts.isVariableDeclaration(parent)) {
			return false;
		}
		if (parent.type === undefined) {
			return false;
		}
		return this.primitive_type_kinds.has(parent.type.kind);
	}

	/** Responsibilities: _identification field assignments outside_. **/
	public field_assignment(node: ts.Node, test_file: boolean, inside_constructor: boolean): boolean {
		if (test_file || inside_constructor) {
			return false;
		}
		return this.is_property_assignment(node);
	}

	/** Responsibilities: _identification conditional assignments primitive_. **/
	public primitive_assignment(node: ts.ConditionalExpression): boolean {
		const parent = node.parent;
		if (!ts.isVariableDeclaration(parent)) {
			return false;
		}
		if (parent.initializer !== node) {
			return false;
		}
		return this.is_primitive_type(parent);
	}
}
