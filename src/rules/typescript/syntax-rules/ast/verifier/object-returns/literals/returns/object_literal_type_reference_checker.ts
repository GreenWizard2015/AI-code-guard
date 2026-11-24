import type { TypeScriptTypeNameLookupContract } from "src/typescript_runtime_protocols";
import ts from "typescript";

/** Responsibilities: _contract type reference checking_, _nested type traversal_. **/
export class ObjectLiteralTypeReferenceChecker {
	private readonly _contract_names: TypeScriptTypeNameLookupContract;

	/** Responsibilities: _type reference name_. **/
	private type_name(node: ts.EntityName): string {
		if (ts.isIdentifier(node)) {
			return node.text;
		}
		return node.right.text;
	}

	/** Responsibilities: _contract name lookup context_. **/
	public constructor(contract_names: TypeScriptTypeNameLookupContract) {
		this._contract_names = contract_names;
	}

	/** Responsibilities: _contract type name lookup_. **/
	public contains_name(node: ts.EntityName): boolean {
		return this._contract_names.contains(this.type_name(node));
	}

	/** Responsibilities: _nested contract type detection_. **/
	public contains(node: ts.TypeNode): boolean {
		if (ts.isTypeReferenceNode(node)) {
			if (this.contains_name(node.typeName)) {
				return true;
			}
			const arguments_list = node.typeArguments;
			if (arguments_list === undefined) {
				return false;
			}
			return arguments_list.some((argument) => this.contains(argument));
		}
		if (ts.isUnionTypeNode(node) || ts.isIntersectionTypeNode(node)) {
			return node.types.some((part) => this.contains(part));
		}
		if (ts.isParenthesizedTypeNode(node)) {
			return this.contains(node.type);
		}
		return false;
	}
}
