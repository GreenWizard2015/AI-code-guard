import ts from 'typescript';
import type { TypeScriptReferenceShape, TypeScriptTypeDetails } from 'src/model/types';

/** Responsibilities: _classification TypeScript type nodes_. **/
export class TypeScriptTypeNode {
	public readonly node: ts.TypeNode;
	private readonly primitive_kinds = new Set([
		ts.SyntaxKind.StringKeyword,
		ts.SyntaxKind.NumberKeyword,
		ts.SyntaxKind.BooleanKeyword,
		ts.SyntaxKind.BigIntKeyword,
		ts.SyntaxKind.NullKeyword,
		ts.SyntaxKind.UndefinedKeyword,
	]);

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
		if (ts.isUnionTypeNode(this.node)) {
			return this.node.types;
		}
		return [];
	}

	/** Responsibilities: _exposure parenthesized type member_. **/
	private parenthesized_type(): readonly ts.TypeNode[] {
		if (ts.isParenthesizedTypeNode(this.node)) {
			return [this.node.type];
		}
		return [];
	}

	/** Responsibilities: _normalization type reference name_. **/
	private reference_shape(): TypeScriptReferenceShape {
		let name = '';
		let arguments_list: readonly ts.TypeNode[] = [];
		if (ts.isTypeReferenceNode(this.node)) {
			if (!ts.isIdentifier(this.node.typeName)) {
				return { name, arguments: arguments_list };
			}
			name = this.node.typeName.text;
			if (this.node.typeArguments) {
				arguments_list = this.node.typeArguments;
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
			return node.types.every(item => this.primitive_node(item));
		}
		return this.primitive_kinds.has(node.kind);
	}

	/** Responsibilities: _initialization wrapped TypeScript type_. **/
	public constructor(node: ts.TypeNode) {
		this.node = node;
	}

	/** Responsibilities: _reporting wrapped type primitive_. **/
	public primitive(): boolean {
		return this.primitive_node(this.node);
	}

	/** Responsibilities: _output normalization union parenthesized_. **/
	public details(): TypeScriptTypeDetails {
		const union_types = this.union_types();
		const reference = this.reference_shape();
		return {
			union: union_types.length > 0,
			union_types,
			parenthesized_type: this.parenthesized_type(),
			is_function: ts.isFunctionTypeNode(this.node),
			reference_name: reference.name,
			reference_arguments: reference.arguments,
		};
	}
}
