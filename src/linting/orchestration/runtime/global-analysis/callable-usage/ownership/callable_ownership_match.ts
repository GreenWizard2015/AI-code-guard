import type { CallableOwnershipMatchOptions } from "src/linting/orchestration/runtime/global-analysis/callable-usage/ownership/types";
import type { AstClassNodeIdentity } from "src/model/ast/normalized_ast_types";
import type { CallableNameRelationsResolver } from "src/runtime_types";
import type { CallableOwnershipRequest } from "src/types";

/** Responsibilities: _callable owner matching_, _interface method matching_. **/
export class CallableOwnershipMatch {
	private readonly _request: CallableOwnershipRequest;
	private readonly _options: CallableOwnershipMatchOptions;
	private readonly _class_identity: AstClassNodeIdentity;

	/** Responsibilities: _reachable type identity traversal_. **/
	private walk_names(start: string, related: CallableNameRelationsResolver): Set<string> {
		const pending = [start];
		const visited = new Set<string>();
		while (pending.length > 0) {
			const current = pending.pop();
			if (!current || visited.has(current)) {
				continue;
			}
			visited.add(current);
			pending.push(...related(current));
		}
		return visited;
	}

	/** Responsibilities: _interface method type lookup_. **/
	private type_names(type_name: string): ReadonlySet<string> {
		const source_file = this._request.source_file;
		const cache_key = `${source_file}::${type_name}`;
		const cached = this._options.type_names_cache.get(cache_key);
		if (cached !== undefined) {
			return cached;
		}
		const members = this._options.identities.visible_type_members(type_name, source_file);
		let names: Set<string>;
		if (members.length === 0) {
			names = new Set([type_name]);
		} else {
			names = this.walk_names(type_name, (name) => this._options.identities.visible_type_members(name, source_file));
		}
		this._options.type_names_cache.set(cache_key, names);
		return names;
	}

	/** Responsibilities: _interface method declaration lookup_. **/
	private type_member_names(type_name: string): ReadonlySet<string> {
		const cache_key = `${this._request.source_file}::${type_name}`;
		const cached = this._options.type_members_cache.get(cache_key);
		if (cached !== undefined) {
			return cached;
		}
		const names = new Set(this._options.identities.visible_type_members(type_name, this._request.source_file));
		this._options.type_members_cache.set(cache_key, names);
		return names;
	}

	/** Responsibilities: _source-visible definition class identity_. **/
	private definition_class_visible(): boolean {
		const { owner, definition_file, source_file } = this._request;
		const definition_identity = `${definition_file}::${this._class_identity.name}`;
		return this._options.identities.class_identities(owner, source_file).includes(definition_identity);
	}

	/** Responsibilities: _inherited callable owner matching_. **/
	private owner_inherits_definition(): boolean {
		const { owner, class_node, definition_file, source_file } = this._request;
		const definition_identity = `${definition_file}::${class_node.identity.name}`;
		for (const owner_identity of this._options.identities.class_identities(owner, source_file)) {
			if (this._options.identities.class_ancestors(owner_identity).has(definition_identity)) {
				return true;
			}
		}
		return false;
	}

	/** Responsibilities: _polymorphic base method dispatch_. **/
	private definition_inherits_owner(): boolean {
		const { owner, class_node, definition_file, source_file } = this._request;
		const definition_identity = `${definition_file}::${class_node.identity.name}`;
		const ancestors = this._options.identities.class_ancestors(definition_identity);
		for (const owner_identity of this._options.identities.class_identities(owner, source_file)) {
			if (ancestors.has(owner_identity)) {
				return true;
			}
		}
		return false;
	}

	/** Responsibilities: _shared concrete descendant matching_. **/
	private shares_concrete_subclass(): boolean {
		const right_identity = `${this._request.source_file}::${this._class_identity.name}`;
		let right_identities: readonly string[];
		if (this._options.class_nodes.has(right_identity)) {
			right_identities = [right_identity];
		} else {
			right_identities = this._options.identities.class_identities(
				this._class_identity.name,
				this._request.source_file,
			);
		}
		return this._options.concrete_descendant_index.present(
			right_identities,
			this._request.owner,
			this._options.identities,
		);
	}

	/** Responsibilities: _related method lookup_. **/
	private related_method_match(names: ReadonlySet<string>): boolean {
		for (const name of names) {
			if (this._options.symbols.type_member_names(name, this._request.source_file).has(this._request.method_name)) {
				return true;
			}
		}
		return false;
	}

	/** Responsibilities: _declared method ownership_. **/
	private declared_method_owner(): boolean {
		const { owner } = this._request;
		if (this.definition_class_visible()) {
			return true;
		}
		for (const interface_name of this._options.class_interfaces) {
			if (interface_name === owner) {
				return true;
			}
		}
		return this.matches_interface();
	}

	/** Responsibilities: _related type ownership_. **/
	private related_type_owner(): boolean {
		const names = this.type_names(this._request.owner);
		if (names.has(this._class_identity.name)) {
			return true;
		}
		if (this.owner_inherits_definition()) {
			return true;
		}
		if (this.definition_inherits_owner()) {
			return true;
		}
		if (this.shares_concrete_subclass()) {
			return true;
		}
		return this.related_method_match(names);
	}

	/** Responsibilities: _callable ownership evaluation initialization_. **/
	public constructor(options: CallableOwnershipMatchOptions) {
		this._request = options.request;
		this._options = options;
		this._class_identity = options.request.class_node.identity;
	}

	/** Responsibilities: _interface method contract lookup_. **/
	public matches_interface(): boolean {
		for (const interface_name of this._options.class_interfaces) {
			const names = this.type_names(interface_name);
			for (const name of names) {
				if (this.type_member_names(name).has(this._request.method_name)) {
					return true;
				}
			}
		}
		return false;
	}

	/** Responsibilities: _callable ownership resolution_. **/
	public match(): boolean {
		if (this.declared_method_owner()) {
			return true;
		}
		return this.related_type_owner();
	}
}
