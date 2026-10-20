import { ProjectSourcePython } from "src/core/project-source/project_source_python";
import { TypeScriptModuleExports } from "src/module-resolution/type_script_module_exports";
import { TypeScriptProjectResolutionCache } from "src/module-resolution/type_script_project_resolution_cache";
import { TypeScriptImportSpecifierCollector } from "src/parser/analysis/type_script_import_specifier_collector";
import { PythonAstData } from "src/core/python_ast_data";
import { PythonAstBridge } from "src/core/python_ast_bridge";
import { readFileSync } from "node:fs";
import { extname } from "node:path";
import ts from "typescript";
import type { NormalizedAstFile } from "src/types";
import type {
	TypeScriptModuleExportsContract,
	TypeScriptModuleResolutionContract,
} from "src/module-resolution/types";
import type { ProjectSourceIOContract, ProjectSourcePythonContract } from "src/source_protocols";
import { SourceText } from "src/source_text";

/** Responsibilities: _project import specifier resolution_, _language-specific import expansion_. **/
export class ProjectSourceImports {
	private readonly python_extension = ".py";
	private readonly project_source_python: ProjectSourcePythonContract;
	private readonly typescript_resolvers: Map<string, TypeScriptModuleExportsContract>;
	private readonly typescript_resolutions: Map<string, TypeScriptModuleResolutionContract>;
	private readonly resolution_cache: TypeScriptProjectResolutionCache;
	private readonly source_io: ProjectSourceIOContract;

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
	private typescript_resolver(root: string): TypeScriptModuleExportsContract {
		const cached = this.typescript_resolvers.get(root);
		if (cached !== undefined) {
			return cached;
		}
		const resolver = new TypeScriptModuleExports(root, new Map(), true, this.source_io);
		this.typescript_resolvers.set(root, resolver);
		return resolver;
	}

	/** Responsibilities: _TypeScript path mapping lookup_. **/
	private typescript_resolution(root: string): TypeScriptModuleResolutionContract {
		const cached = this.typescript_resolutions.get(root);
		if (cached !== undefined) {
			return cached;
		}
		const resolution = this.resolution_cache.resolution(root, true);
		this.typescript_resolutions.set(root, resolution);
		return resolution;
	}

	/** Responsibilities: _resolution TypeScript import specifier_. **/
	private resolve_typescript_import(root: string, importer: string, specifier: string, files: Set<string>): string {
		const candidate = this.typescript_resolver(root).module_symbol(importer, specifier);
		if (files.has(candidate)) {
			return candidate;
		}
		if ([".js", ".mjs", ".cjs"].includes(extname(candidate))) {
			if (this.source_io.source_available(candidate)) {
				return candidate;
			}
		}
		const emitted_file = this.emitted_javascript_file(candidate);
		if (emitted_file.length > 0) {
			if (this.source_io.source_available(emitted_file)) {
				return emitted_file;
			}
		}
		return "";
	}

	/** Responsibilities: _Python project imports_. **/
	private python_project_specifiers(
		ast: NormalizedAstFile,
		root: string,
		importer: string,
		files: Set<string>,
	): string[] {
		const imports = ast.python_imports;
		if (imports === undefined) {
			return [];
		}
		const specifiers: string[] = [];
		for (const item of imports) {
			this.project_source_python.append_import_names(specifiers, item, root, importer, files);
		}
		return specifiers;
	}

	/** Responsibilities: _extraction import specifiers directly_. **/
	/** Responsibilities: _field initialization_. **/
	constructor() {
		this.project_source_python = new ProjectSourcePython();
		this.typescript_resolvers = new Map<string, TypeScriptModuleExportsContract>();
		this.typescript_resolutions = new Map<string, TypeScriptModuleResolutionContract>();
		this.source_io = new SourceText();
		this.resolution_cache = new TypeScriptProjectResolutionCache(this.source_io);
	}
	/** Responsibilities: _public operation_. **/
	public import_specifiers(file: string, root: string, files: Set<string>): string[] {
		const python_ast_parser = new PythonAstData(new PythonAstBridge());
		if (extname(file) === this.python_extension) {
			return this.python_project_specifiers(
				python_ast_parser.source_ast(readFileSync(file, "utf8")),
				root,
				file,
				files,
			);
		}
		const source_file = ts.createSourceFile(file, readFileSync(file, "utf8"), ts.ScriptTarget.Latest, true);
		const collector = new TypeScriptImportSpecifierCollector(source_file);
		return collector.collect();
	}

	/** Responsibilities: _resolution direct import specifier_. **/
	public specifier_path(root: string, file: string, specifier: string, files: Set<string>): string {
		if (extname(file) === this.python_extension) {
			return this.project_source_python.python_import_path(root, file, specifier, files);
		}
		return this.resolve_typescript_import(root, file, specifier, files);
	}

	/** Responsibilities: _path alias classification_. **/
	public path_alias_configured(root: string, specifier: string): boolean {
		return this.typescript_resolution(root).path_alias_configured(specifier);
	}
}
