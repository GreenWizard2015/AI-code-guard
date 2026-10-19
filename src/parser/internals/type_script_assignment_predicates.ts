import ts from "typescript";
import { TypeScriptExpressionAliases } from "src/typescript-aliases/type_script_expression_aliases";
import type { TypeScriptAssignmentContext } from "src/types";
import type { TypeScriptAssignmentPredicatesContract } from "src/protocols";

/** Responsibilities: _property assignments classification_, _primitive assignments classification_. **/
export class TypeScriptAssignmentPredicates implements TypeScriptAssignmentPredicatesContract {
	private readonly self_aliases: TypeScriptExpressionAliases;
	private readonly primitive_type_kinds: Set<ts.SyntaxKind>;

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
	/** Responsibilities: _field initialization_. **/
	constructor() {
		this.self_aliases = new TypeScriptExpressionAliases("this");
		this.primitive_type_kinds = new Set([
			ts.SyntaxKind.StringKeyword,
			ts.SyntaxKind.NumberKeyword,
			ts.SyntaxKind.BooleanKeyword,
			ts.SyntaxKind.BigIntKeyword,
			ts.SyntaxKind.NullKeyword,
			ts.SyntaxKind.UndefinedKeyword,
		]);
	}
	/** Responsibilities: _public operation_. **/
	public field_assignment(node: ts.Node, context: TypeScriptAssignmentContext): boolean {
		if (context.test_file || context.inside_constructor) {
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
