import type { TypeScriptReferenceShape, TypeScriptTypeDetails } from "src/model/types";
import type { TypeScriptTypeNodeContract } from "src/typescript_analysis_protocols";
import ts from "typescript";

/** Responsibilities: _primitive type classification_, _type detail extraction_. **/
export class TypeScriptTypeNode implements TypeScriptTypeNodeContract {
	private readonly _node: ts.TypeNode;
	private readonly _primitive_kinds: Set<ts.SyntaxKind>;

	/** Responsibilities: _classification literal type expression_. **/
	private literal_is_primitive(literal: ts.Expression): boolean {
		if (ts.isStringLiteral(literal) || ts.isNumericLiteral(literal)) {
			return true;
		}
		if (ts.isBigIntLiteral(literal)) {
			return true;
		}
		if (literal.kind === ts.SyntaxKind.TrueKeyword) {
			return true;
		}
		if (literal.kind === ts.SyntaxKind.FalseKeyword) {
			return true;
		}
		return literal.kind === ts.SyntaxKind.NullKeyword;
	}

	/** Responsibilities: _exposure union members empty_. **/
	private union_types(): readonly ts.TypeNode[] {
		if (ts.isUnionTypeNode(this._node)) {
			return this._node.types;
		}
		return [];
	}

	/** Responsibilities: _exposure parenthesized type member_. **/
	private parenthesized_type(): readonly ts.TypeNode[] {
		if (ts.isParenthesizedTypeNode(this._node)) {
			return [this._node.type];
		}
		return [];
	}

	/** Responsibilities: _normalization type reference name_. **/
	private reference_shape(): TypeScriptReferenceShape {
		let name = "";
		let arguments_list: readonly ts.TypeNode[] = [];
		if (ts.isTypeReferenceNode(this._node)) {
			if (!ts.isIdentifier(this._node.typeName)) {
				return { name, arguments: arguments_list };
			}
			name = this._node.typeName.text;
			if (this._node.typeArguments) {
				arguments_list = this._node.typeArguments;
			}
		}
		return { name, arguments: arguments_list };
	}

	/** Responsibilities: _classification type node primitive_. **/
	private primitive_node(node: ts.TypeNode): boolean {
		if (ts.isLiteralTypeNode(node) && this.literal_is_primitive(node.literal)) {
			return true;
		}
		if (ts.isUnionTypeNode(node)) {
			return node.types.every((item) => this.primitive_node(item));
		}
		return this._primitive_kinds.has(node.kind);
	}

	/** Responsibilities: _initialization wrapped TypeScript type_. **/
	public constructor(node: ts.TypeNode) {
		this._primitive_kinds = new Set([
			ts.SyntaxKind.StringKeyword,
			ts.SyntaxKind.NumberKeyword,
			ts.SyntaxKind.BooleanKeyword,
			ts.SyntaxKind.BigIntKeyword,
			ts.SyntaxKind.NullKeyword,
			ts.SyntaxKind.UndefinedKeyword,
		]);
		this._node = node;
	}

	/** Responsibilities: _reporting wrapped type primitive_. **/
	public primitive(): boolean {
		return this.primitive_node(this._node);
	}

	/** Responsibilities: _output normalization union parenthesized_. **/
	public details(): TypeScriptTypeDetails {
		const union_types = this.union_types();
		const reference = this.reference_shape();
		return {
			union: union_types.length > 0,
			union_types,
			parenthesized_type: this.parenthesized_type(),
			is_function: ts.isFunctionTypeNode(this._node),
			reference_name: reference.name,
			reference_arguments: reference.arguments,
		};
	}
}
