import { extname } from "node:path";
import { TYPESCRIPT_CACHE_OWNER, TYPESCRIPT_LANGUAGE } from "src/constants";
import { ProjectSourceContextImportResolution } from "src/core/project-source/project_source_context_import_resolution";
import { ProjectSourcePython } from "src/core/project-source/project_source_python";
import type { ContextProjectPaths } from "src/core/types";
import type { AstLanguage, NormalizedAstFile } from "src/model/ast/normalized_ast_types";
import { TypeScriptModuleExportsContext } from "src/module-resolution/exports/type_script_module_exports_context";
import { TypeScriptProjectResolutionCache } from "src/module-resolution/project-resolution/type_script_project_resolution_cache";
import type { TypeScriptModuleExportsContract, TypeScriptModuleResolutionContract } from "src/module-resolution/types";
import { TypeScriptImportSpecifierCollector } from "src/parser/analysis/type_script_import_specifier_collector";
import type { LintProjectContextContract } from "src/shared_services_protocols";
import type {
	ProjectSourceContextImportResolutionContract,
	ProjectSourceContextImportResolutionOptions,
	ProjectSourceContextImportsContract,
	ProjectSourceIOContract,
	ProjectSourcePythonContract,
} from "src/source_protocols";
import ts from "typescript";

/** Responsibilities: _context-bound import resolution_, _cross-language import expansion_. **/
export class ProjectSourceContextImports implements ProjectSourceContextImportsContract {
	private readonly _root: string;
	private readonly _context: LintProjectContextContract;
	private readonly _source_io: ProjectSourceIOContract;
	private readonly _project_source_python: ProjectSourcePythonContract;
	private readonly _resolvers: WeakMap<LintProjectContextContract, TypeScriptModuleExportsContract>;
	private readonly _resolutions: WeakMap<LintProjectContextContract, TypeScriptModuleResolutionContract>;
	private readonly _resolution_cache: TypeScriptProjectResolutionCache;
	private readonly _project_files: WeakMap<LintProjectContextContract, ContextProjectPaths>;

	/** Responsibilities: _context source file access_. **/
	private source_file(source_record_path: string): ts.SourceFile {
		const source = this._context.source_record(source_record_path);
		if (source.language === TYPESCRIPT_CACHE_OWNER) {
			return source.typescript_ast.source_file_node();
		}
		return ts.createSourceFile(source_record_path, source.text, ts.ScriptTarget.Latest, true);
	}

	/** Responsibilities: _Python project import collection_. **/
	private python_imports(ast: NormalizedAstFile, importer: string): string[] {
		const specifiers: string[] = [];
		const python_imports = this._project_source_python.for_files(this.source_paths());
		for (const item of ast.source.python_imports) {
			specifiers.push(...python_imports.import_names({ importer, item }));
		}
		return specifiers;
	}

	/** Responsibilities: _contextual module resolution_. **/
	private source_files(): Map<string, ts.SourceFile> {
		const source_files = new Map<string, ts.SourceFile>();
		for (const source of this._context.files()) {
			if (source.language === TYPESCRIPT_CACHE_OWNER) {
				source_files.set(source.absolute_path, source.typescript_ast.source_file_node());
			}
		}
		return source_files;
	}

	/** Responsibilities: _context module resolver access_. **/
	private module_resolver(): TypeScriptModuleExportsContract {
		const cached = this._resolvers.get(this._context);
		if (cached !== undefined) {
			return cached;
		}
		const resolver_context = new TypeScriptModuleExportsContext(
			this._root,
			this.source_files(),
			false,
			this._source_io,
		);
		const resolver = resolver_context.module_exports();
		this._resolvers.set(this._context, resolver);
		return resolver;
	}

	/** Responsibilities: _context path mappings_. **/
	private path_mappings(): TypeScriptModuleResolutionContract {
		const cached = this._resolutions.get(this._context);
		if (cached !== undefined) {
			return cached;
		}
		const resolution = this._resolution_cache.resolution(this._root, false);
		this._resolutions.set(this._context, resolution);
		return resolution;
	}

	/** Responsibilities: _project source path access_. **/
	private source_paths(): ReadonlySet<string> {
		const cached = this._project_files.get(this._context);
		if (cached !== undefined) {
			return cached;
		}
		const paths = new Set(this._context.files().map((source) => source.absolute_path));
		this._project_files.set(this._context, paths);
		return paths;
	}

	/** Responsibilities: _module source path resolution_. **/
	private module_source_path(candidate: string): string {
		if (this.source_paths().has(candidate)) {
			return candidate;
		}
		if (![".js", ".mjs", ".cjs"].includes(extname(candidate))) {
			return "";
		}
		if (this._source_io.source_available(candidate)) {
			return candidate;
		}
		return "";
	}

	/** Responsibilities: _TypeScript import resolution result_. **/
	private typescript_resolution(
		importer_path: string,
		specifier: string,
		language: AstLanguage,
		resolver: TypeScriptModuleExportsContract,
	): ProjectSourceContextImportResolutionContract {
		const candidate = resolver.module_symbol(importer_path, specifier);
		let path_alias_configured = false;
		if (language === TYPESCRIPT_LANGUAGE) {
			path_alias_configured = this.path_mappings().path_alias_configured(specifier);
		}
		return new ProjectSourceContextImportResolution({
			context: this._context,
			source_files: this.source_paths(),
			resolver,
			module_file: candidate,
			resolved_path: this.module_source_path(candidate),
			path_alias_configured,
		});
	}

	/** Responsibilities: _project context imports setup_. **/
	public constructor(root: string, context: LintProjectContextContract, source_io: ProjectSourceIOContract) {
		this._root = root;
		this._context = context;
		this._source_io = source_io;
		this._project_source_python = new ProjectSourcePython(root);
		this._resolvers = new WeakMap<LintProjectContextContract, TypeScriptModuleExportsContract>();
		this._resolutions = new WeakMap<LintProjectContextContract, TypeScriptModuleResolutionContract>();
		this._resolution_cache = new TypeScriptProjectResolutionCache(source_io);
		this._project_files = new WeakMap<LintProjectContextContract, ReadonlySet<string>>();
	}

	/** Responsibilities: _project import specifiers_. **/
	public imports(file: string): string[] {
		const source = this._context.source_record(file);
		if (source.language !== TYPESCRIPT_CACHE_OWNER) {
			return this.python_imports(source.normalized_ast, file);
		}
		const collector = new TypeScriptImportSpecifierCollector(this.source_file(file));
		return collector.collect();
	}

	/** Responsibilities: _project import resolution_. **/
	public resolve(importer_path: string, specifier: string): ProjectSourceContextImportResolutionContract {
		const source = this._context.source_record(importer_path);
		const resolver = this.module_resolver();
		if (source.language === "python") {
			const path = this._project_source_python
				.for_files(this.source_paths())
				.resolve_import({ importer: importer_path, specifier });
			const options: ProjectSourceContextImportResolutionOptions = {
				context: this._context,
				source_files: this.source_paths(),
				resolver,
				module_file: "",
				resolved_path: path,
				path_alias_configured: false,
			};
			return new ProjectSourceContextImportResolution(options);
		}
		return this.typescript_resolution(importer_path, specifier, source.language, resolver);
	}
}
