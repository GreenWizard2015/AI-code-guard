import type {
	CallableClassIndex,
	CallableProjectIndex,
} from 'src/metrics/types';
import type { AstClassNode } from 'src/types';

/** Responsibilities: _resolution callable ownership traverse_. **/
export class CallableOwnershipGraph {
	private readonly project_types: CallableProjectIndex;
	private readonly class_nodes: CallableClassIndex;
	private readonly type_names_cache = new Map<string, Set<string>>();
	private readonly base_names_cache = new Map<string, Set<string>>();
	private readonly type_members_cache = new Map<string, ReadonlySet<string>>();

	/** Responsibilities: _related type names traversal_. **/
	private walk_names(start: string, related: (name: string) => string[]): Set<string> {
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

	/** Responsibilities: _class base names collection_. **/
	private class_bases(name: string): string[] {
		const node = this.class_nodes.get(name);
		if (node?.base_class_names !== undefined) {
			return node.base_class_names;
		}
		if (node?.base_class_name !== undefined) {
			return [node.base_class_name];
		}
		return [];
	}

	/** Responsibilities: _identification type reachability class_. **/
	private type_reaches_class(class_name: string, type_name: string = '', method_name: string = ''): boolean {
		if (!type_name) {
			return false;
		}
		const names = this.type_names(type_name);
		if (this.has_class_name(names, class_name)) {
			return true;
		}
		return this.has_port_method(names, method_name);
	}

	/** Responsibilities: _identification class name graph_. **/
	private has_class_name(names: Set<string>, class_name: string): boolean {
		for (const name of names) {
			if (name === class_name) {
				return true;
			}
		}
		return false;
	}

	/** Responsibilities: _identification port methods graph_. **/
	private has_port_method(names: Set<string>, method_name = ''): boolean {
		if (method_name.length === 0) {
			return false;
		}
		for (const name of names) {
if (name.endsWith('Port') && this.type_member_names(name).has(method_name)) {
				return true;
			}
		}
		return false;
	}

	/** Responsibilities: _callable ownership matching_. **/
	private matches_graph(class_node: AstClassNode, method_name: string, owner: string = ''): boolean {
		if (this.matches_interface(class_node, method_name)) {
			return true;
		}
		const reaches_owner = this.type_reaches_class(class_node.name, owner);
		const shares_subclass = this.shares_concrete_subclass(class_node.name, owner);
		if (reaches_owner || shares_subclass) {
			return true;
		}
		return this.type_reaches_class(class_node.name, owner, method_name);
	}

	/** Responsibilities: _callable ownership matching_. **/
	private matches_interface(class_node: AstClassNode, method_name: string): boolean {
		if (class_node.interfaces.length === 0) {
			return false;
		}
		return this.interface_method(class_node.interfaces, method_name);
	}

	/** Responsibilities: _reachable type names collection_. **/
	private type_names(type_name: string): Set<string> {
		const cached = this.type_names_cache.get(type_name);
		if (cached !== undefined) {
			return cached;
		}
		const members = this.type_members(type_name);
		let names: Set<string>;
		if (members.length === 0) {
			names = new Set([type_name]);
		} else {
			names = this.walk_names(type_name, name => this.type_members(name));
		}
		this.type_names_cache.set(type_name, names);
		return names;
	}

	/** Responsibilities: _type member names collection_. **/
	private type_members(type_name: string): string[] {
		const members = this.project_types.get(type_name);
		if (members === undefined) {
			return [];
		}
		return Object.values(members);
	}

	/** Responsibilities: _cache type member names_. **/
	private type_member_names(type_name: string): ReadonlySet<string> {
		const cached = this.type_members_cache.get(type_name);
		if (cached !== undefined) {
			return cached;
		}
		const members = this.project_types.get(type_name);
		let names: ReadonlySet<string> = new Set();
		if (members !== undefined) {
			names = new Set(Object.keys(members));
		}
		this.type_members_cache.set(type_name, names);
		return names;
	}

	/** Responsibilities: _collection reachable base class_. **/
	private base_class_names(class_name: string): Set<string> {
		const cached = this.base_names_cache.get(class_name);
		if (cached !== undefined) {
			return cached;
		}
		const bases = this.class_bases(class_name);
		let names: Set<string>;
		if (bases.length === 0) {
			names = new Set([class_name]);
		} else {
			names = this.walk_names(class_name, name => this.class_bases(name));
		}
		this.base_names_cache.set(class_name, names);
		return names;
	}

	/** Responsibilities: _shared concrete subclasses identification_. **/
	private shares_concrete_subclass(right: string, left: string = ''): boolean {
		if (!left) {
			return false;
		}
		return [...this.class_nodes.values()]
			.filter(node => !node.protocol && !node.type_contract)
			.some(node => {
				const ancestors = this.base_class_names(node.name);
				return ancestors.has(left) && ancestors.has(right);
			});
	}

	/** Responsibilities: _initialization callable ownership graph_. **/
	constructor(project_types: CallableProjectIndex, class_nodes: CallableClassIndex) {
		this.project_types = project_types;
		this.class_nodes = class_nodes;
	}

	/** Responsibilities: _identification method reachable interface_. **/
	public interface_method(interfaces: string[], method_name: string): boolean {
		for (const interface_name of interfaces) {
			for (const type_name of this.type_names(interface_name)) {
				if (this.type_member_names(type_name).has(method_name)) {
					return true;
				}
			}
		}
		return false;
	}

	/** Responsibilities: _callable owner matching_. **/
	public match(class_node: AstClassNode, method_name: string, owner: string = ''): boolean {
		if (owner !== undefined) {
			if (this.type_member_names(owner).has(method_name)) {
				return true;
			}
			if (class_node.interfaces?.includes(owner) === true) {
				return true;
			}
		}
		return this.matches_graph(class_node, method_name, owner);
	}
}
