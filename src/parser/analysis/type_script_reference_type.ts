import type ts from "typescript";

import { TypeScriptTypeNode } from "src/model/type_script_type_node";
import type { TypeScriptTypeNodeContract } from "src/typescript_analysis_protocols";

/** Responsibilities: _reference owner resolution_, _aliased type name resolution_. **/
export class TypeScriptReferenceType {
	private readonly _type_node: TypeScriptTypeNodeContract;

	/** Responsibilities: _resolution first owner name_. **/
	private first_owner(nodes: readonly ts.TypeNode[]): string {
		for (const node of nodes) {
			const reference = new TypeScriptReferenceType(node);
			const owner = reference.return_owner();
			if (owner) {
				return owner;
			}
		}
		return "";
	}

	/** Responsibilities: _resolution owner name nested_. **/
	private nested_owner(): string {
		const details = this._type_node.details();
		if (details.parenthesized_type.length > 0) {
			const type = details.parenthesized_type.at(0);
			if (type === undefined) {
				return "";
			}
			const reference = new TypeScriptReferenceType(type);
			return reference.return_owner();
		}
		return this.first_owner(details.union_types);
	}

	/** Responsibilities: _resolution nested reference name_. **/
	private nested_name(aliases: ReadonlyMap<string, string>): string {
		const details = this._type_node.details();
		let nested_types = details.union_types;
		if (details.parenthesized_type.length > 0) {
			nested_types = details.parenthesized_type;
		}
		for (const type of nested_types) {
			const reference = new TypeScriptReferenceType(type);
			const name = reference.resolved_name(aliases);
			if (name) {
				return name;
			}
		}
		return "";
	}

	/** Responsibilities: _initialization wrapped TypeScript reference_. **/
	public constructor(node: ts.TypeNode) {
		this._type_node = new TypeScriptTypeNode(node);
	}

	/** Responsibilities: _resolution owner type represented_. **/
	public return_owner(): string {
		const nested = this.nested_owner();
		if (nested) {
			return nested;
		}
		const details = this._type_node.details();
		return details.reference_name;
	}

	/** Responsibilities: _resolution canonical reference name_. **/
	public resolved_name(aliases: ReadonlyMap<string, string>): string {
		const nested = this.nested_name(aliases);
		if (nested) {
			return nested;
		}
		const name = this._type_node.details().reference_name;
		if (!name) {
			return "";
		}
		const alias = aliases.get(name);
		if (alias !== undefined) {
			return alias;
		}
		return name;
	}
}
