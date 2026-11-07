import { relative, resolve } from "node:path";
import { ProjectSourceContextImports } from "src/core/project-source/project_source_context_imports";
import type { NormalizedAstSource, TestTargetImport } from "src/model/ast/normalized_ast_types";
import type { LintProjectContextContract } from "src/shared_services_protocols";
import type { ProjectSourceContextImportsContract } from "src/source_protocols";
import type { TestTargetImportResolverContract } from "src/testing_protocols";

/** Responsibilities: _test import path resolution_, _declaration target lookup_. **/
export class ProjectTestTargetImportPaths implements TestTargetImportResolverContract {
	private readonly _root: string;
	private readonly _context: LintProjectContextContract;
	private readonly _imports: ProjectSourceContextImportsContract;

	/** Responsibilities: _Python imported declaration path_. **/
	private python_declaration_path(importer: string, specifier: string, name: string): string {
		const candidate = this._imports.resolve(importer, specifier).path();
		if (candidate.length === 0) {
			return "";
		}
		const declarations = this._context.source_record(candidate).normalized_ast.source;
		if (this.python_declaration_match(declarations, name)) {
			return candidate;
		}
		return "";
	}

	/** Responsibilities: _Python declaration matching_. **/
	private python_declaration_match(declarations: NormalizedAstSource, imported_name: string): boolean {
		if (declarations.classes.some((item) => item.identity.name === imported_name)) {
			return true;
		}
		for (const item of declarations.functions) {
			if (item.identity.name !== imported_name) {
				continue;
			}
			if (item.identity.owner.length > 0) {
				continue;
			}
			if (item.identity.nested !== true) {
				return true;
			}
		}
		return false;
	}

	/** Responsibilities: _project import resolution initialization_. **/
	public constructor(root: string, context: LintProjectContextContract) {
		this._root = root;
		this._context = context;
		this._imports = new ProjectSourceContextImports(root, context, context.source_io());
	}

	/** Responsibilities: _source-relative import resolution_. **/
	public path(file: string, specifier: string): string {
		const importer = resolve(this._root, file);
		const candidate = this._imports.resolve(importer, specifier).path();
		if (candidate.length === 0) {
			return "";
		}
		return relative(this._root, candidate).replaceAll("\\", "/");
	}

	/** Responsibilities: _top-level imported declaration paths_. **/
	public declaration_paths(file: string, imports: readonly TestTargetImport[], python: boolean): string[] {
		const importer = resolve(this._root, file);
		const paths: string[] = [];
		for (const item of imports) {
			for (const name of item.names) {
				let candidate = "";
				if (python) {
					candidate = this.python_declaration_path(importer, item.specifier, name);
				} else {
					candidate = this._imports.resolve(importer, item.specifier).declaration_path(name);
				}
				if (candidate.length > 0) {
					paths.push(relative(this._root, candidate).replaceAll("\\", "/"));
				}
			}
		}
		return paths;
	}
}
