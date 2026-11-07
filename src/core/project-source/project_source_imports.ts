import { readFileSync } from "node:fs";
import { extname } from "node:path";
import { ProjectSourcePython } from "src/core/project-source/project_source_python";
import { PythonAstBridge } from "src/core/python-ast/python_ast_bridge";
import { PythonAstData } from "src/core/python-ast/python_ast_data";
import { SourceText } from "src/io/source_text";
import { TypeScriptModuleExportsContext } from "src/module-resolution/exports/type_script_module_exports_context";
import { TypeScriptProjectResolutionCache } from "src/module-resolution/project-resolution/type_script_project_resolution_cache";
import type { TypeScriptModuleExportsContract, TypeScriptModuleResolutionContract } from "src/module-resolution/types";
import { TypeScriptImportSpecifierCollector } from "src/parser/analysis/type_script_import_specifier_collector";
import type {
	ProjectSourceIOContract,
	ProjectSourceImportsContract,
	ProjectSourcePythonContract,
} from "src/source_protocols";
import ts from "typescript";

/** Responsibilities: _project import specifier resolution_, _language-specific import expansion_. **/
export class ProjectSourceImports implements ProjectSourceImportsContract {
	private readonly _root: string;
	private readonly python_extension = ".py";
	private readonly _project_source_python: ProjectSourcePythonContract;
	private readonly _typescript_resolvers: Map<string, TypeScriptModuleExportsContract>;
	private readonly _typescript_resolutions: Map<string, TypeScriptModuleResolutionContract>;
	private readonly _resolution_cache: TypeScriptProjectResolutionCache;
	private readonly _source_io: ProjectSourceIOContract;

	/** Responsibilities: _TypeScript emitted module path_. **/
	private emitted_javascript_file(candidate: string): string {
		switch (extname(candidate)) {
			case ".ts":
				return candidate.replace(/\.ts$/u, ".js");
			case ".tsx":
				return candidate.replace(/\.tsx$/u, ".jsx");
			case ".mts":
				return candidate.replace(/\.mts$/u, ".mjs");
			case ".cts":
				return candidate.replace(/\.cts$/u, ".cjs");
			default:
				return "";
		}
	}

	/** Responsibilities: _TypeScript module resolver ownership_. **/
	private typescript_resolver(): TypeScriptModuleExportsContract {
		const cached = this._typescript_resolvers.get(this._root);
		if (cached !== undefined) {
			return cached;
		}
		const resolver_context = new TypeScriptModuleExportsContext(this._root, new Map(), true, this._source_io);
		const resolver = resolver_context.module_exports();
		this._typescript_resolvers.set(this._root, resolver);
		return resolver;
	}

	/** Responsibilities: _TypeScript path mapping lookup_. **/
	private typescript_resolution(): TypeScriptModuleResolutionContract {
		const cached = this._typescript_resolutions.get(this._root);
		if (cached !== undefined) {
			return cached;
		}
		const resolution = this._resolution_cache.resolution(this._root, true);
		this._typescript_resolutions.set(this._root, resolution);
		return resolution;
	}

	/** Responsibilities: _available TypeScript output resolution_. **/
	private available_typescript_path(candidate: string): string {
		const candidate_extension = extname(candidate);
		if ([".js", ".mjs", ".cjs"].includes(candidate_extension)) {
			if (this._source_io.source_available(candidate)) {
				return candidate;
			}
		}
		const emitted_file = this.emitted_javascript_file(candidate);
		if (emitted_file.length > 0) {
			if (this._source_io.source_available(emitted_file)) {
				return emitted_file;
			}
		}
		return "";
	}

	/** Responsibilities: _Python import specifier collection_. **/
	private python_import_specifiers(python_source_file: string, project_source_paths: Set<string>): string[] {
		const python_ast_bridge = new PythonAstBridge();
		const python_ast_options = python_ast_bridge.options();
		const python_ast_parser = new PythonAstData(python_ast_options);
		const ast = python_ast_parser.source_ast(readFileSync(python_source_file, "utf8"));
		const specifiers: string[] = [];
		const python_imports = ast.source.python_imports;
		if (python_imports !== undefined) {
			for (const item of python_imports) {
				specifiers.push(
					...this._project_source_python
						.for_files(project_source_paths)
						.import_names({ importer: python_source_file, item }),
				);
			}
		}
		return specifiers;
	}

	/** Responsibilities: _project import resolver initialization_. **/
	/** Responsibilities: _field initialization_. **/
	public constructor(root: string) {
		this._root = root;
		this._project_source_python = new ProjectSourcePython(root);
		this._typescript_resolvers = new Map<string, TypeScriptModuleExportsContract>();
		this._typescript_resolutions = new Map<string, TypeScriptModuleResolutionContract>();
		this._source_io = new SourceText();
		this._resolution_cache = new TypeScriptProjectResolutionCache(this._source_io);
	}

	/** Responsibilities: _public operation_. **/
	public import_specifiers(file: string, files: Set<string>): string[] {
		if (extname(file) === this.python_extension) {
			return this.python_import_specifiers(file, files);
		}
		const source_file = ts.createSourceFile(file, readFileSync(file, "utf8"), ts.ScriptTarget.Latest, true);
		const collector = new TypeScriptImportSpecifierCollector(source_file);
		return collector.collect();
	}
	/** Responsibilities: _resolution direct import specifier_. **/
	public specifier_path(file: string, specifier: string, files: Set<string>): string {
		if (extname(file) === this.python_extension) {
			return this._project_source_python.for_files(files).resolve_import({ importer: file, specifier });
		}
		const candidate = this.typescript_resolver().module_symbol(file, specifier);
		if (files.has(candidate)) {
			return candidate;
		}
		return this.available_typescript_path(candidate);
	}

	/** Responsibilities: _path alias classification_. **/
	public path_alias_configured(specifier: string): boolean {
		return this.typescript_resolution().path_alias_configured(specifier);
	}
}
