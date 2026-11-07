import { INSTANCE_PROPERTY_SIDE } from "src/constants";
import type {
	CallOwnerResolverContract,
	TypeScriptDestructuredAliasCollectorContract,
	TypeScriptInstanceStoreContract,
	TypeScriptPropertyContext,
	TypeScriptPropertyStateContract,
} from "src/model/protocols";
import type { DestructuredAlias } from "src/model/types";
import { TypeScriptDestructuredAliasCollector } from "src/parser/references/identity/calls/type_script_destructured_alias_collector";
import { TypeScriptPropertyNodeCollector } from "src/parser/references/identity/properties/type_script_property_node_collector";
import { TypeScriptReferenceBinding } from "src/parser/type_script_reference_binding";
import type { TypeScriptPropertyAddress } from "src/types";
import ts from "typescript";

/** Responsibilities: _property owner state_, _destructured alias tracking_. **/
export class TypeScriptPropertyState implements TypeScriptPropertyStateContract {
	private readonly _destructured_alias_collector: TypeScriptDestructuredAliasCollectorContract;
	private readonly _node_collector: TypeScriptPropertyNodeCollector;
	private readonly _properties: Map<string, string>;

	/** Responsibilities: _owned property recording_. **/
	private append_owned_node(node: ts.Node, context: TypeScriptPropertyContext): void {
		if (context.owner.length === 0) {
			return;
		}
		this._node_collector.append_node(node, context);
	}

	/** Responsibilities: _owned property tree traversal_. **/
	private append_owned_tree(node: ts.Node, inherited_context: TypeScriptPropertyContext): void {
		const context = this._node_collector.owner_context(node, inherited_context);
		this.append_owned_node(node, context);
		ts.forEachChild(node, (child) => this.append_owned_tree(child, context));
	}

	/** Responsibilities: _property state initialization_. **/
	public constructor(
		aliases: Map<string, string>,
		call_owner: CallOwnerResolverContract,
		instances: TypeScriptInstanceStoreContract,
	) {
		this._properties = new Map<string, string>();
		this._node_collector = new TypeScriptPropertyNodeCollector({
			properties: this._properties,
			reference_binding: new TypeScriptReferenceBinding(aliases, instances),
			call_owner,
		});
		this._destructured_alias_collector = new TypeScriptDestructuredAliasCollector(this, call_owner, instances);
	}

	/** Responsibilities: _TypeScript property tree collection_. **/
	public append_tree(root_node: ts.Node): void {
		this.append_owned_tree(root_node, { owner: "", side: INSTANCE_PROPERTY_SIDE });
	}

	/** Responsibilities: _property owner lookup_. **/
	public property_owner(address: TypeScriptPropertyAddress): string {
		const owner = this._properties.get(JSON.stringify([address.side, address.owner, address.property]));
		if (owner === undefined) {
			return "";
		}
		return owner;
	}

	/** Responsibilities: _object property owner storage_. **/
	public store_object_property(address: TypeScriptPropertyAddress, property_owner: string): void {
		const key = JSON.stringify([address.side, address.owner, address.property]);
		if (this._properties.get(key) === property_owner) {
			return;
		}
		this._properties.set(key, property_owner);
	}

	/** Responsibilities: _destructured alias collection_. **/
	public destructured_aliases(
		pattern: ts.ObjectBindingPattern,
		source_file: ts.SourceFile,
		initializer: ts.Expression,
		current_owner = "",
	): readonly DestructuredAlias[] {
		return [...this._destructured_alias_collector.collect(pattern, source_file, initializer, current_owner)];
	}
}
