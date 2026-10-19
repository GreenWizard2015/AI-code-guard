import type { CallableClassIndex, CallableProjectIndex, ParsedFile } from "src/metrics/types";
import type { AstClassNode } from "src/types";
import type { CallableSymbolIndexContract, NameRelationsResolver, StringReadonlySetMap, StringSetMap } from "src/protocols";
import { CallableSymbolIndex } from "src/linting/orchestration/runtime/composition/callable_symbol_index";
import { CallableSourceIdentityGraph } from "src/linting/orchestration/runtime/global-analysis/callable-usage/callable_source_identity_graph";
import { CallableConcreteDescendantIndex } from "src/linting/orchestration/runtime/global-analysis/callable-usage/callable_concrete_descendant_index";
import type { CallableSourceIdentityGraphContract } from "src/protocols";

/** Responsibilities: _callable ownership traversal_, _typed relationship matching_. **/
export class CallableOwnershipGraph {
	private readonly class_nodes: CallableClassIndex;
	private readonly symbols: CallableSymbolIndexContract;
	private readonly identities: CallableSourceIdentityGraphContract;
	private readonly type_names_cache: StringSetMap;
	private readonly type_members_cache: StringReadonlySetMap;
	private readonly concrete_descendant_index: CallableConcreteDescendantIndex;

	/** Responsibilities: _related type names traversal_. **/
	private walk_names(start: string, related: NameRelationsResolver): Set<string> {
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

	/** Responsibilities: _identification type reachability class_. **/
	private type_reaches_class(class_name: string, type_name = "", method_name = "", source_file = ""): boolean {
		if (!type_name) {
			return false;
		}
		const names = this.type_names(type_name, source_file);
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
	private has_port_method(names: Set<string>, method_name = "", source_file = ""): boolean {
		if (method_name.length === 0) {
			return false;
		}
		for (const name of names) {
			if (name.endsWith("Port") && this.symbols.type_member_names(name, source_file).has(method_name)) {
				return true;
			}
		}
		return false;
	}

	/** Responsibilities: _callable ownership matching_. **/
	private matches_graph(class_node: AstClassNode, method_name: string, owner = "", source_file = ""): boolean {
		if (this.matches_interface(class_node, method_name, source_file)) {
			return true;
		}
		const reaches_owner = this.type_reaches_class(class_node.name, owner, "", source_file);
		const shares_subclass = this.shares_concrete_subclass(class_node.name, owner, source_file);
		if (reaches_owner || shares_subclass) {
			return true;
		}
		return this.type_reaches_class(class_node.name, owner, method_name, source_file);
	}

	/** Responsibilities: _callable ownership matching_. **/
	private matches_interface(class_node: AstClassNode, method_name: string, source_file = ""): boolean {
		if (class_node.interfaces.length === 0) {
			return false;
		}
		return this.interface_method(class_node.interfaces, method_name, source_file);
	}

	/** Responsibilities: _reachable type names collection_. **/
	private type_names(type_name: string, source_file = ""): Set<string> {
		const cache_key = `${source_file}::${type_name}`;
		const cached = this.type_names_cache.get(cache_key);
		if (cached !== undefined) {
			return cached;
		}
		const members = this.identities.visible_type_members(type_name, source_file);
		let names: Set<string>;
		if (members.length === 0) {
			names = new Set([type_name]);
		} else {
			names = this.walk_names(type_name, (name) => this.identities.visible_type_members(name, source_file));
		}
		this.type_names_cache.set(cache_key, names);
		return names;
	}

	/** Responsibilities: _cache type member names_. **/
	private type_member_names(type_name: string, source_file = ""): ReadonlySet<string> {
		const cache_key = `${source_file}::${type_name}`;
		const cached = this.type_members_cache.get(cache_key);
		if (cached !== undefined) {
			return cached;
		}
		const names = new Set(this.identities.visible_type_members(type_name, source_file));
		this.type_members_cache.set(cache_key, names);
		return names;
	}

	/** Responsibilities: _right class identities_. **/
	private right_identities(right: string, source_file: string): readonly string[] {
		const right_identity = `${source_file}::${right}`;
		if (this.class_nodes.has(right_identity)) {
			return [right_identity];
		}
		return this.identities.class_identities(right, source_file);
	}

	/** Responsibilities: _shared concrete subclasses identification_. **/
	private shares_concrete_subclass(right: string, left = "", source_file = ""): boolean {
		if (!left) {
			return false;
		}
		return this.concrete_descendant_index.present(this.right_identities(right, source_file), left, this.identities);
	}

	/** Responsibilities: _initialization callable ownership graph_. **/
	constructor(
		project_types: CallableProjectIndex,
		class_nodes: CallableClassIndex,
		parsed_files: readonly ParsedFile[] = [],
	) {
		this.type_names_cache = new Map<string, Set<string>>();
		this.type_members_cache = new Map<string, ReadonlySet<string>>();
		this.class_nodes = class_nodes;
		this.symbols = new CallableSymbolIndex(project_types);
		const identities = new CallableSourceIdentityGraph(class_nodes, project_types);
		identities.index_sources(parsed_files);
		this.identities = identities;
		this.concrete_descendant_index = new CallableConcreteDescendantIndex(identities.concrete_descendants(class_nodes));
	}

	/** Responsibilities: _identification method reachable interface_. **/
	public interface_method(interfaces: string[], method_name: string, source_file = ""): boolean {
		for (const interface_name of interfaces) {
			for (const type_name of this.type_names(interface_name, source_file)) {
				if (this.type_member_names(type_name, source_file).has(method_name)) {
					return true;
				}
			}
		}
		return false;
	}

	/** Responsibilities: _callable owner matching_. **/
	public match(class_node: AstClassNode, method_name: string, owner = "", source_file = ""): boolean {
		if (owner !== undefined) {
			if (this.type_member_names(owner, source_file).has(method_name)) {
				return true;
			}
			if (class_node.interfaces?.includes(owner)) {
				return true;
			}
		}
		return this.matches_graph(class_node, method_name, owner, source_file);
	}
}
