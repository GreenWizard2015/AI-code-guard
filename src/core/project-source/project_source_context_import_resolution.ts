import { TYPESCRIPT_CACHE_OWNER } from "src/constants";
import { TypeScriptDeclarationMatcher } from "src/core/project-source/type_script_declaration_matcher";
import type { TypeScriptModuleSymbolReference } from "src/module-resolution/types";
import type { TypeScriptModuleExportsContract } from "src/module-resolution/types";
import type { LintProjectContextContract } from "src/shared_services_protocols";
import type {
	ProjectSourceContextImportResolutionContract,
	ProjectSourceContextImportResolutionOptions,
} from "src/source_protocols";

/** Responsibilities: _context import resolution_, _declaration source resolution_. **/
export class ProjectSourceContextImportResolution implements ProjectSourceContextImportResolutionContract {
	private readonly _context: LintProjectContextContract;
	private readonly _source_files: ReadonlySet<string>;
	private readonly _resolver: TypeScriptModuleExportsContract;
	private readonly _module_file: string;
	private readonly _resolved_path: string;
	private readonly _alias_configured: boolean;

	/** Responsibilities: _project declaration membership_. **/
	private declaration_in_project(declaration: TypeScriptModuleSymbolReference): boolean {
		if (declaration.file.length === 0 || !this._source_files.has(declaration.file)) {
			return false;
		}
		const source = this._context.source_record(declaration.file);
		if (source.language !== TYPESCRIPT_CACHE_OWNER) {
			return false;
		}
		const matcher = new TypeScriptDeclarationMatcher(declaration.name);
		return matcher.matches_source(source.typescript_ast.source_file_node());
	}

	/** Responsibilities: _import resolver initialization_. **/
	public constructor(options: ProjectSourceContextImportResolutionOptions) {
		this._context = options.context;
		this._source_files = options.source_files;
		this._resolver = options.resolver;
		this._module_file = options.module_file;
		this._resolved_path = options.resolved_path;
		this._alias_configured = options.path_alias_configured;
	}

	/** Responsibilities: _import path resolution_. **/
	public path(): string {
		return this._resolved_path;
	}

	/** Responsibilities: _path alias configuration_. **/
	public path_alias_configured(): boolean {
		return this._alias_configured;
	}

	/** Responsibilities: _imported declaration resolution_. **/
	public declaration_path(name: string): string {
		if (this._module_file.length === 0) {
			return "";
		}
		const declaration = this._resolver.resolve({ file: this._module_file, name });
		if (!this.declaration_in_project(declaration)) {
			return "";
		}
		return declaration.file;
	}
}
