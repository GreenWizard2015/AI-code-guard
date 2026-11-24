import type {
	CallableOwnerMethodNamesContract,
	CallableUsageDefinition,
	MethodOwnerIndexes,
} from "src/contracts/types/callable_usage_types";

/** Responsibilities: _owner method names_, _method declaration counts_. **/
export class MethodOwnerIndex {
	private readonly _methods_by_owner: Map<string, CallableOwnerMethodNamesContract>;
	private readonly _method_owner_counts: Map<string, number>;

	/** Responsibilities: _single method indexing_. **/
	private append_definition(definition: CallableUsageDefinition): void {
		const owner = definition.node.identity.owner;
		if (definition.kind !== "method" || owner.length === 0) {
			return;
		}
		let method_names = this._methods_by_owner.get(owner);
		if (method_names === undefined) {
			method_names = new Set<string>();
			this._methods_by_owner.set(owner, method_names);
		}
		method_names.add(definition.node.identity.name);
		const previous_count = this._method_owner_counts.get(owner);
		let next_count = 1;
		if (previous_count !== undefined) {
			next_count = previous_count + 1;
		}
		this._method_owner_counts.set(owner, next_count);
	}

	/** Responsibilities: _owner index initialization_. **/
	public constructor() {
		this._methods_by_owner = new Map();
		this._method_owner_counts = new Map();
	}

	/** Responsibilities: _method definition indexing_. **/
	public append(definitions: readonly CallableUsageDefinition[]): void {
		for (const definition of definitions) {
			this.append_definition(definition);
		}
	}

	/** Responsibilities: _owner method index result_. **/
	public indexes(): MethodOwnerIndexes {
		return {
			methods_by_owner: this._methods_by_owner,
			method_owner_counts: this._method_owner_counts,
		};
	}
}
