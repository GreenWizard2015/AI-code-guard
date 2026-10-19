import ts from "typescript";
import { extname } from "node:path";
import { ProjectSourcePython } from "src/core/project-source/project_source_python";
import { TypeScriptModuleExports } from "src/module-resolution/type_script_module_exports";
import { TypeScriptProjectResolutionCache } from "src/module-resolution/type_script_project_resolution_cache";
import { TypeScriptImportSpecifierCollector } from "src/parser/analysis/type_script_import_specifier_collector";
import type {
	LintProjectContextContract,
	ProjectSourceContextImportsContract,
	ProjectSourcePythonContract,
	ProjectSourceIOContract,
} from "src/protocols";
import type { NormalizedAstFile } from "src/types";
import { TYPESCRIPT_LANGUAGE } from "src/constants";
import type {
	ResolvedTypeScriptExport,
	TypeScriptModuleExportsContract,
	TypeScriptModuleResolutionContract,
} from "src/module-resolution/types";
import type { ContextProjectPaths } from "src/core/types";

/** Responsibilities: _context-bound import resolution_, _cross-language import expansion_. **/
export class ProjectSourceContextImports implements ProjectSourceContextImportsContract {
	private readonly root: string;
	private readonly context: LintProjectContextContract;
	private readonly source_io: ProjectSourceIOContract;
	private readonly project_source_python: ProjectSourcePythonContract;
	private readonly resolvers: WeakMap<LintProjectContextContract, TypeScriptModuleExportsContract>;
	private readonly resolutions: WeakMap<LintProjectContextContract, TypeScriptModuleResolutionContract>;
	private readonly resolution_cache: TypeScriptProjectResolutionCache;
	private readonly project_files: WeakMap<LintProjectContextContract, ContextProjectPaths>;

	/** Responsibilities: _context source file access_. **/
	private source_file(file: string): ts.SourceFile {
		const source = this.context.source_record(file);
		if (source.typescript()) {
			return source.typescript_ast.source_file_node();
		}
		return ts.createSourceFile(file, source.text, ts.ScriptTarget.Latest, true);
	}

	/** Responsibilities: _TypeScript declaration name matching_. **/
	private named_declaration(node: ts.Node, name: string): boolean {
		if (ts.isClassDeclaration(node) || ts.isFunctionDeclaration(node)) {
			if (node.name !== undefined) {
				return node.name.text === name;
			}
		}
		return false;
	}

	/** Responsibilities: _function-valued variable matching_. **/
	private function_variable(node: ts.Node, name: string): boolean {
		if (!ts.isVariableStatement(node)) {
			return false;
		}
		return node.declarationList.declarations.some((declaration) => {
			if (!ts.isIdentifier(declaration.name)) {
				return false;
			}
			if (declaration.name.text !== name) {
				return false;
			}
			const initializer = declaration.initializer;
			if (initializer === undefined) {
				return false;
			}
			return ts.isArrowFunction(initializer) || ts.isFunctionExpression(initializer);
		});
	}

	/** Responsibilities: _Python project import collection_. **/
	private python_imports(ast: NormalizedAstFile, importer: string): string[] {
		const specifiers: string[] = [];
		for (const item of ast.python_imports) {
			this.project_source_python.append_import_names(specifiers, item, this.root, importer, this.source_paths());
		}
		return specifiers;
	}

	/** Responsibilities: _declaration source path_. **/
	private declaration_source_path(declaration: ResolvedTypeScriptExport): string {
		const source = this.context.source_record(declaration.file);
		if (!source.typescript()) {
			return "";
		}
		if (!this.source_declares(source.typescript_ast.source_file_node(), declaration.name)) {
			return "";
		}
		return declaration.file;
	}

	/** Responsibilities: _TypeScript declaration lookup_. **/
	private source_declares(source_file: ts.SourceFile, name: string): boolean {
		for (const statement of source_file.statements) {
			if (this.named_declaration(statement, name)) {
				return true;
			}
			if (this.function_variable(statement, name)) {
				return true;
			}
		}
		return false;
	}

	/** Responsibilities: _contextual module resolution_. **/
	private source_files(): Map<string, ts.SourceFile> {
		const source_files = new Map<string, ts.SourceFile>();
		for (const source of this.context.files()) {
			if (source.typescript()) {
				source_files.set(source.absolute_path, source.typescript_ast.source_file_node());
			}
		}
		return source_files;
	}

	/** Responsibilities: _context module resolver access_. **/
	private module_resolver(): TypeScriptModuleExportsContract {
		const cached = this.resolvers.get(this.context);
		if (cached !== undefined) {
			return cached;
		}
		const resolver = new TypeScriptModuleExports(this.root, this.source_files(), false, this.source_io);
		this.resolvers.set(this.context, resolver);
		return resolver;
	}

	/** Responsibilities: _context path mappings_. **/
	private path_mappings(): TypeScriptModuleResolutionContract {
		const cached = this.resolutions.get(this.context);
		if (cached !== undefined) {
			return cached;
		}
		const resolution = this.resolution_cache.resolution(this.root, false);
		this.resolutions.set(this.context, resolution);
		return resolution;
	}

	/** Responsibilities: _project source path access_. **/
	private source_paths(): ReadonlySet<string> {
		const cached = this.project_files.get(this.context);
		if (cached !== undefined) {
			return cached;
		}
		const paths = new Set(this.context.files().map((source) => source.absolute_path));
		this.project_files.set(this.context, paths);
		return paths;
	}

	/** Responsibilities: _project context imports setup_. **/
	public constructor(root: string, context: LintProjectContextContract, source_io: ProjectSourceIOContract) {
		this.root = root;
		this.context = context;
		this.source_io = source_io;
		this.project_source_python = new ProjectSourcePython();
		this.resolvers = new WeakMap<LintProjectContextContract, TypeScriptModuleExportsContract>();
		this.resolutions = new WeakMap<LintProjectContextContract, TypeScriptModuleResolutionContract>();
		this.resolution_cache = new TypeScriptProjectResolutionCache(source_io);
		this.project_files = new WeakMap<LintProjectContextContract, ReadonlySet<string>>();
	}

	/** Responsibilities: _project import specifiers_. **/
	public imports(file: string): string[] {
		const source = this.context.source_record(file);
		if (!source.typescript()) {
			return this.python_imports(source.normalized_ast, file);
		}
		const collector = new TypeScriptImportSpecifierCollector(this.source_file(file));
		return collector.collect();
	}

	/** Responsibilities: _project import path resolution_. **/
	public path(file: string, specifier: string): string {
		const source = this.context.source_record(file);
		if (source.language === "python") {
			return this.project_source_python.python_import_path(this.root, file, specifier, this.source_paths());
		}
		const candidate = this.module_resolver().module_symbol(file, specifier);
		if (this.source_paths().has(candidate)) {
			return candidate;
		}
		if ([".js", ".mjs", ".cjs"].includes(extname(candidate))) {
			if (this.source_io.source_available(candidate)) {
				return candidate;
			}
		}
		return "";
	}

	/** Responsibilities: _path alias classification_. **/
	public path_alias_configured(file: string, specifier: string): boolean {
		if (this.context.source_record(file).language !== TYPESCRIPT_LANGUAGE) {
			return false;
		}
		return this.path_mappings().path_alias_configured(specifier);
	}

	/** Responsibilities: _imported declaration path resolution_. **/
	public declaration_path(file: string, specifier: string, name: string): string {
		const resolver = this.module_resolver();
		const module_file = resolver.module_symbol(file, specifier);
		if (module_file.length === 0) {
			return "";
		}
		const declaration = resolver.resolve(module_file, name);
		if (declaration.file.length === 0) {
			return "";
		}
		return this.declaration_source_path(declaration);
	}
}
