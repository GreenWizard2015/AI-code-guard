import { COLLECTION_TYPE_NAMES } from "src/constants";
import { READONLY_BUILTIN_TYPES, TYPESCRIPT_ARRAY_TYPE_NAME } from "src/metrics/constants";
import ts from "typescript";

/** Responsibilities: _AST type classification_, _collection type classification_. **/
export class TypeScriptAstTypeShape {
	private readonly _type: ts.TypeNode;

	/** Responsibilities: _primitive type classification_. **/
	private primitive_type(node: ts.TypeNode): boolean {
		const primitive_kinds = [
			ts.SyntaxKind.StringKeyword,
			ts.SyntaxKind.NumberKeyword,
			ts.SyntaxKind.BooleanKeyword,
			ts.SyntaxKind.BigIntKeyword,
			ts.SyntaxKind.SymbolKeyword,
			ts.SyntaxKind.NullKeyword,
		];
		if (primitive_kinds.includes(node.kind)) {
			return true;
		}
		return ts.isLiteralTypeNode(node);
	}

	/** Responsibilities: _collection reference classification_. **/
	private collection_type_reference(type_reference: ts.TypeReferenceNode): boolean {
		if (!ts.isIdentifier(type_reference.typeName)) {
			return false;
		}
		const name = type_reference.typeName.text;
		if (name === TYPESCRIPT_ARRAY_TYPE_NAME) {
			return true;
		}
		if (COLLECTION_TYPE_NAMES.has(name)) {
			return true;
		}
		return READONLY_BUILTIN_TYPES.has(name);
	}

	/** Responsibilities: _named primitive reference classification_. **/
	private builtin_data_reference(type_reference: ts.TypeReferenceNode): boolean {
		if (!ts.isIdentifier(type_reference.typeName)) {
			return false;
		}
		return ["Boolean", "Number", "String"].includes(type_reference.typeName.text);
	}

	/** Responsibilities: _composite type expansion_. **/
	private expand_composite(node: ts.TypeNode, pending: ts.TypeNode[]): boolean {
		if (ts.isUnionTypeNode(node)) {
			pending.push(...node.types);
			return true;
		}
		if (ts.isParenthesizedTypeNode(node)) {
			pending.push(node.type);
			return true;
		}
		return false;
	}

	/** Responsibilities: _data type member classification_. **/
	private data_member(type_node: ts.TypeNode): boolean {
		if (this.primitive_type(type_node)) {
			return true;
		}
		if (ts.isArrayTypeNode(type_node) || ts.isTupleTypeNode(type_node)) {
			return true;
		}
		if (!ts.isTypeReferenceNode(type_node)) {
			return false;
		}
		return this.collection_type_reference(type_node) || this.builtin_data_reference(type_node);
	}

	/** Responsibilities: _scalar type member classification_. **/
	private scalar_member(scalar_node: ts.TypeNode): boolean {
		if (this.primitive_type(scalar_node)) {
			return true;
		}
		return ts.isTypeReferenceNode(scalar_node) && this.builtin_data_reference(scalar_node);
	}

	/** Responsibilities: _type shape initialization_. **/
	public constructor(type: ts.TypeNode) {
		this._type = type;
	}

	/** Responsibilities: _recursive data type classification_. **/
	public data_type(): boolean {
		const pending: ts.TypeNode[] = [this._type];
		while (pending.length > 0) {
			const type_node = pending.pop();
			if (type_node === undefined) {
				continue;
			}
			if (this.expand_composite(type_node, pending)) {
				continue;
			}
			if (!this.data_member(type_node)) {
				return false;
			}
		}
		return true;
	}

	/** Responsibilities: _recursive scalar type classification_. **/
	public scalar_type(): boolean {
		const pending: ts.TypeNode[] = [this._type];
		while (pending.length > 0) {
			const scalar_node = pending.pop();
			if (scalar_node === undefined) {
				continue;
			}
			if (this.expand_composite(scalar_node, pending)) {
				continue;
			}
			if (!this.scalar_member(scalar_node)) {
				return false;
			}
		}
		return true;
	}

	/** Responsibilities: _collection type classification_. **/
	public collection_type(): boolean {
		if (ts.isArrayTypeNode(this._type)) {
			return true;
		}
		if (ts.isTupleTypeNode(this._type)) {
			return true;
		}
		return ts.isTypeReferenceNode(this._type) && this.collection_type_reference(this._type);
	}
}
