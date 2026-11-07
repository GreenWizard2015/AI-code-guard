import type { CallableSourceIdentityGraphContract, CallableSymbolIndexContract } from "src/analysis_protocols";
import type { ReadonlyStringSetMap, StringReadonlyMap, StringReadonlySetMap, StringSetMap } from "src/analysis_types";
import { CallableSymbolIndex } from "src/linting/orchestration/runtime/global-analysis/callable-usage/ownership/callable_symbol_index";
import type { CallableClassIndex, CallableProjectIndex, ParsedFile } from "src/metrics/types";
import type { AstClassNode } from "src/model/ast/normalized_ast_types";

/** Responsibilities: _source-qualified class identity_, _import-visible type identity_. **/
export class CallableSourceIdentityGraph implements CallableSourceIdentityGraphContract {
	private readonly _class_nodes: CallableClassIndex;
	private readonly _symbols: CallableSymbolIndexContract;
	private readonly _files_by_name: Map<string, ParsedFile>;
	private readonly _aliases_by_file: StringReadonlyMap;
	private readonly _scopes_by_file: StringReadonlySetMap;
	private readonly _named_class_ids: Map<string, string[]>;
	private readonly _ancestors_by_identity: StringSetMap;

	/** Responsibilities: _source-visible file names_. **/
	/** Responsibilities: _imported source file scope_. **/
	private imported_scope(source: ParsedFile): ReadonlySet<string> {
		const scope = new Set<string>([source.file]);
		for (const imported of source.imports) {
			const imported_file = this._files_by_name.get(imported);
			if (imported_file !== undefined) {
				scope.add(imported_file.file);
			}
		}
		return scope;
	}

	/** Responsibilities: _source-visible file scope_. **/
	private source_scope(scope_file: string): ReadonlySet<string> {
		const source = this._files_by_name.get(scope_file);
		if (source === undefined) {
			return new Set([scope_file]);
		}
		const cached = this._scopes_by_file.get(source.file);
		if (cached !== undefined) {
			return cached;
		}
		const scope = this.imported_scope(source);
		this._scopes_by_file.set(source.file, scope);
		this._scopes_by_file.set(source.absolute_file, scope);
		return scope;
	}

	/** Responsibilities: _import alias resolution_. **/
	private resolved_name(name: string, alias_file: string): string {
		const aliases = this._aliases_by_file.get(alias_file);
		if (aliases !== undefined) {
			const resolved = aliases.get(name);
			if (resolved !== undefined) {
				return resolved;
			}
		}
		return name;
	}

	/** Responsibilities: _source-qualified base ancestors_. **/
	private append_base_ancestors(node: AstClassNode, owner_file: string, known: Set<string>): void {
		for (const base of node.structure.base_class_names) {
			for (const base_identity of this.class_identities(base, owner_file)) {
				this.append_ancestors(base_identity, known);
			}
		}
	}

	/** Responsibilities: _source-qualified class ancestors_. **/
	private append_ancestors(identity: string, known: Set<string>): void {
		if (known.has(identity)) {
			return;
		}
		known.add(identity);
		const separator = identity.lastIndexOf("::");
		if (separator < 0) {
			return;
		}
		const file_name = identity.slice(0, separator);
		const node = this._class_nodes.get(identity);
		if (node === undefined) {
			return;
		}
		this.append_base_ancestors(node, file_name, known);
	}

	/** Responsibilities: _initialization source identity graph_. **/
	public constructor(class_nodes: CallableClassIndex, project_types: CallableProjectIndex) {
		this._files_by_name = new Map<string, ParsedFile>();
		this._aliases_by_file = new Map<string, ReadonlyMap<string, string>>();
		this._scopes_by_file = new Map<string, ReadonlySet<string>>();
		this._named_class_ids = new Map<string, string[]>();
		this._ancestors_by_identity = new Map<string, Set<string>>();
		this._class_nodes = class_nodes;
		this._symbols = new CallableSymbolIndex(project_types);
	}

	/** Responsibilities: _source identity indexes_. **/
	public index_sources(parsed_files: readonly ParsedFile[]): void {
		for (const file of parsed_files) {
			this._files_by_name.set(file.file, file);
			this._files_by_name.set(file.absolute_file, file);
			const aliases = new Map(file.reference_aliases.map((alias) => [alias.name, alias.target]));
			this._aliases_by_file.set(file.file, aliases);
			this._aliases_by_file.set(file.absolute_file, aliases);
		}
		for (const [identity, node] of this._class_nodes) {
			const identities = this._named_class_ids.get(node.identity.name);
			if (identities === undefined) {
				this._named_class_ids.set(node.identity.name, [identity]);
				continue;
			}
			identities.push(identity);
		}
	}

	/** Responsibilities: _source-qualified class ancestors_. **/
	public class_ancestors(identity: string): Set<string> {
		const cached = this._ancestors_by_identity.get(identity);
		if (cached !== undefined) {
			return cached;
		}
		const known = new Set<string>();
		this.append_ancestors(identity, known);
		this._ancestors_by_identity.set(identity, known);
		return known;
	}

	/** Responsibilities: _concrete descendant ownership index_. **/
	public concrete_descendants(class_nodes: CallableClassIndex): ReadonlyStringSetMap {
		const descendants = new Map<string, Set<string>>();
		for (const [identity, node] of class_nodes) {
			if (node.classification.protocol || node.classification.type_contract) {
				continue;
			}
			for (const ancestor of this.class_ancestors(identity)) {
				let entries = descendants.get(ancestor);
				if (entries === undefined) {
					entries = new Set<string>();
					descendants.set(ancestor, entries);
				}
				entries.add(identity);
			}
		}
		return descendants;
	}

	/** Responsibilities: _source-qualified type members_. **/
	public visible_type_members(type_name: string, source_file: string): string[] {
		const resolved = this.resolved_name(type_name, source_file);
		const members: string[] = [];
		for (const file_name of this.source_scope(source_file)) {
			members.push(...this._symbols.type_members(resolved, file_name));
		}
		return members;
	}

	/** Responsibilities: _source-qualified class lookup_. **/
	public class_identities(name: string, source_file: string): string[] {
		if (source_file.length === 0 || name.length === 0) {
			return [];
		}
		const resolved = this.resolved_name(name, source_file);
		const identities = this._named_class_ids.get(resolved);
		if (identities === undefined) {
			return [];
		}
		const scope = this.source_scope(source_file);
		return identities.filter((identity) => scope.has(identity.slice(0, identity.lastIndexOf("::"))));
	}
}
