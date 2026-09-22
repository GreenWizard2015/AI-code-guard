import type ts from 'typescript';

import { TypeScriptTypeNode } from 'src/model/typescript-type-node';

/** Responsibilities: _resolution TypeScript reference names_. **/
export class TypeScriptReferenceType {
	private readonly type_node: TypeScriptTypeNode;

	/** Responsibilities: _resolution first owner name_. **/
	private first_owner(nodes: readonly ts.TypeNode[]): string {
		for (const node of nodes) {
			const reference = new TypeScriptReferenceType(node);
			const owner = reference.return_owner();
			if (owner) {
				return owner;
			}
		}
		return '';
	}

	/** Responsibilities: _resolution owner name nested_. **/
	private nested_owner(): string {
		const details = this.type_node.details();
		if (details.parenthesized_type.length > 0) {
			const reference = new TypeScriptReferenceType(details.parenthesized_type[0]);
			return reference.return_owner();
		}
		return this.first_owner(details.union_types);
	}

	/** Responsibilities: _resolution nested reference name_. **/
	private nested_name(aliases: ReadonlyMap<string, string>): string {
		const details = this.type_node.details();
		if (details.parenthesized_type.length > 0) {
			const reference = new TypeScriptReferenceType(details.parenthesized_type[0]);
			return reference.resolved_name(aliases);
		}
		for (const type of details.union_types) {
			const reference = new TypeScriptReferenceType(type);
			const name = reference.resolved_name(aliases);
			if (name) {
				return name;
			}
		}
		return '';
	}

	/** Responsibilities: _initialization wrapped TypeScript reference_. **/
	public constructor(node: ts.TypeNode) {
		this.type_node = new TypeScriptTypeNode(node);
	}

	/** Responsibilities: _resolution owner type represented_. **/
	public return_owner(): string {
		const nested = this.nested_owner();
		if (nested) {
			return nested;
		}
		const details = this.type_node.details();
		if (!details.reference_name) {
			return '';
		}
		const argument_owner = this.first_owner(details.reference_arguments);
		if (argument_owner) {
			return argument_owner;
		}
		return details.reference_name;
	}

	/** Responsibilities: _resolution canonical reference name_. **/
	public resolved_name(aliases: ReadonlyMap<string, string>): string {
		const nested = this.nested_name(aliases);
		if (nested) {
			return nested;
		}
		const name = this.type_node.details().reference_name;
		if (!name) {
			return '';
		}
		const alias = aliases.get(name);
		if (alias !== undefined) {
			return alias;
		}
		return name;
	}
}
