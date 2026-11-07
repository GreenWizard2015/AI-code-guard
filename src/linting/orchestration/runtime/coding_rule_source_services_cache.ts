import type { CodingRuleSourceServices } from "src/linting/orchestration/runtime/types";
import { AstPropertySourceIndexCache } from "src/model/ast/ast_property_source_index_cache";
import { TypeScriptModuleExportsContext } from "src/module-resolution/exports/type_script_module_exports_context";
import { ASTVerifierRegistry } from "src/rules/typescript/syntax-rules/ast/verifier/ast_verifier_registry";
import type { ProjectSourceIOContract } from "src/source_protocols";
import type { SourceFileResolver } from "src/source_types";

/** Responsibilities: _resolver cache_, _analysis service storage_. **/
export class CodingRuleSourceServicesCache {
	private readonly _project_root: string;
	private readonly _filesystem_fallback: boolean;
	private readonly _source_io: ProjectSourceIOContract;
	private readonly _services_by_resolver: WeakMap<SourceFileResolver, CodingRuleSourceServices>;

	/** Responsibilities: _resolver cache initialization_. **/
	public constructor(project_root: string, filesystem_fallback: boolean, source_io: ProjectSourceIOContract) {
		this._project_root = project_root;
		this._filesystem_fallback = filesystem_fallback;
		this._source_io = source_io;
		this._services_by_resolver = new WeakMap();
	}

	/** Responsibilities: _resolver service lookup_. **/
	public for_resolver(resolver: SourceFileResolver): CodingRuleSourceServices {
		const services = this._services_by_resolver.get(resolver);
		if (services !== undefined) {
			return services;
		}
		const exports_context = new TypeScriptModuleExportsContext(
			this._project_root,
			resolver,
			this._filesystem_fallback,
			this._source_io,
		);
		const node_rules = new ASTVerifierRegistry();
		node_rules.initialize();
		const created = {
			module_exports: exports_context.module_exports(),
			source_index: new AstPropertySourceIndexCache(),
			node_rules,
		};
		this.remember_for_resolver(resolver, created);
		return created;
	}

	/** Responsibilities: _resolver service storage_. **/
	public remember_for_resolver(resolver: SourceFileResolver, services: CodingRuleSourceServices): void {
		this._services_by_resolver.set(resolver, services);
	}
}
