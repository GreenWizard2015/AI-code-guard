import type { ObjectLiteralTypeNameLookupContract } from "src/shared_services_protocols";
import ts from "typescript";

/** Responsibilities: _contract alias expansion_, _transitive type lookup_. **/
export class ObjectLiteralTypeAliasChain {
	private readonly _names: ObjectLiteralTypeNameLookupContract;
	private readonly _aliases_by_target: ReadonlyMap<string, readonly ts.TypeAliasDeclaration[]>;

	/** Responsibilities: _alias candidate registration_. **/
	private append_alias(statement: ts.TypeAliasDeclaration): boolean {
		if (!ts.isTypeReferenceNode(statement.type)) {
			return false;
		}
		const target = this.type_name(statement.type.typeName);
		if (!this._names.contains(target)) {
			return false;
		}
		if (this._names.contains(statement.name.text)) {
			return false;
		}
		this._names.register_alias(statement.name.text);
		return true;
	}

	/** Responsibilities: _type reference name_. **/
	private type_name(node: ts.EntityName): string {
		if (ts.isIdentifier(node)) {
			return node.text;
		}
		return node.right.text;
	}

	/** Responsibilities: _alias chain context_. **/
	public constructor(
		names: ObjectLiteralTypeNameLookupContract,
		aliases_by_target: ReadonlyMap<string, readonly ts.TypeAliasDeclaration[]>,
	) {
		this._names = names;
		this._aliases_by_target = aliases_by_target;
	}

	/** Responsibilities: _target alias lookup_. **/
	public aliases_for_target(target: string): readonly ts.TypeAliasDeclaration[] {
		const aliases = this._aliases_by_target.get(target);
		if (aliases === undefined) {
			return [];
		}
		return aliases;
	}

	/** Responsibilities: _transitive aliases_. **/
	public append(seeds: readonly string[]): void {
		const pending = [...seeds];
		const queued = new Set(seeds);
		for (const target of pending) {
			for (const alias of this.aliases_for_target(target)) {
				if (!this.append_alias(alias) || queued.has(alias.name.text)) {
					continue;
				}
				queued.add(alias.name.text);
				pending.push(alias.name.text);
			}
		}
	}
}
