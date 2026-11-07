import type { ModulePathResolverContract } from "src/module-resolution/types";
import { RestUnionSourceAliases } from "src/rules/typescript/syntax-rules/types/rest_union/rest_union_source_aliases";
import type {
	RestUnionAliasDeclarations,
	RestUnionPreparedAliasCache,
	RestUnionResolverAliasCache,
	RestUnionSourceAliasCache,
} from "src/rules/typescript/syntax-rules/types/types";
import type { SourceFileResolver } from "src/source_types";
import ts from "typescript";

/** Responsibilities: _imported type alias resolution_, _rest-union declaration indexing_. **/
export class RestUnionImportedAliases {
	private readonly _alias_cache: RestUnionSourceAliasCache;
	private readonly _prepared_aliases: RestUnionPreparedAliasCache;

	/** Responsibilities: _nested alias collection_. **/
	private collect_aliases(
		node: ts.Node,
		namespace: readonly string[],
		aliases: Map<string, ts.TypeAliasDeclaration>,
	): void {
		if (ts.isModuleDeclaration(node)) {
			if (node.body !== undefined) {
				this.collect_aliases(node.body, [...namespace, node.name.getText()], aliases);
			}
			return;
		}
		if (ts.isTypeAliasDeclaration(node)) {
			const qualified_name_parts = [...namespace, node.name.text];
			aliases.set(qualified_name_parts.join("."), node);
		}
		node.forEachChild((child) => this.collect_aliases(child, namespace, aliases));
	}

	/** Responsibilities: _resolver cache selection_. **/
	private resolver_cache(
		cache_owner: ts.SourceFile,
		module_path: ModulePathResolverContract,
	): RestUnionResolverAliasCache {
		let by_module = this._prepared_aliases.get(cache_owner);
		if (by_module === undefined) {
			by_module = new WeakMap<ModulePathResolverContract, RestUnionResolverAliasCache>();
			this._prepared_aliases.set(cache_owner, by_module);
		}
		let by_resolver = by_module.get(module_path);
		if (by_resolver === undefined) {
			by_resolver = new WeakMap<SourceFileResolver, RestUnionAliasDeclarations>();
			by_module.set(module_path, by_resolver);
		}
		return by_resolver;
	}

	/** Responsibilities: _field initialization_. **/
	public constructor() {
		this._alias_cache = new WeakMap<ts.SourceFile, RestUnionAliasDeclarations>();
		this._prepared_aliases = new WeakMap();
	}

	/** Responsibilities: _source alias resolution_. **/
	public aliases_for(
		source_file: ts.SourceFile,
		module_path: ModulePathResolverContract,
		source_resolver: SourceFileResolver,
	): RestUnionAliasDeclarations {
		const cache = this.resolver_cache(source_file, module_path);
		const cached = cache.get(source_resolver);
		if (cached !== undefined) {
			return cached;
		}
		const local_aliases = new Map<string, ts.TypeAliasDeclaration>();
		this.append_local(source_file, local_aliases);
		const source_aliases = new RestUnionSourceAliases({
			source_file,
			module_path,
			source_resolver,
			alias_cache: this._alias_cache,
			local_aliases,
		});
		const aliases = source_aliases.aliases();
		cache.set(source_resolver, aliases);
		return aliases;
	}

	/** Responsibilities: _local alias transfer_. **/
	public append_local(source_file: ts.SourceFile, aliases: Map<string, ts.TypeAliasDeclaration>): void {
		let declarations = this._alias_cache.get(source_file);
		if (declarations === undefined) {
			const collected = new Map<string, ts.TypeAliasDeclaration>();
			for (const node of source_file.statements) {
				this.collect_aliases(node, [], collected);
			}
			this._alias_cache.set(source_file, collected);
			declarations = collected;
		}
		for (const [name, declaration] of declarations) {
			aliases.set(name, declaration);
		}
	}
}
