import { relative, resolve } from "node:path";
import { ProjectSourceContextImports } from "src/core/project-source/project_source_context_imports";
import type {
	LintProjectContextContract,
	ProjectSourceContextImportsContract,
	TestTargetImportResolverContract,
} from "src/protocols";
import type { AstCallableNodeContract, TestTargetImport } from "src/types";

/** Responsibilities: _test import path resolution_, _declaration target lookup_. **/
export class ProjectTestTargetImportPaths implements TestTargetImportResolverContract {
	private readonly root: string;
	private readonly context: LintProjectContextContract;
	private readonly imports: ProjectSourceContextImportsContract;

	/** Responsibilities: _Python imported declaration path_. **/
	private python_declaration_path(importer: string, specifier: string, name: string): string {
		const candidate = this.imports.path(importer, specifier);
		if (candidate.length === 0) {
			return "";
		}
		const source = this.context.source_record(candidate);
		const has_class = source.normalized_ast.classes.some((item) => item.name === name);
		const has_function = source.normalized_ast.functions.some((item) => this.top_level_function(item, name));
		if (has_class) {
			return candidate;
		}
		if (has_function) {
			return candidate;
		}
		return "";
	}

	/** Responsibilities: _top-level function declaration classification_. **/
	private top_level_function(item: AstCallableNodeContract, name: string): boolean {
		if (item.name !== name) {
			return false;
		}
		if (item.owner !== undefined) {
			if (item.owner.length > 0) {
				return false;
			}
		}
		return item.nested !== true;
	}

	/** Responsibilities: _project import resolution initialization_. **/
	public constructor(root: string, context: LintProjectContextContract) {
		this.root = root;
		this.context = context;
		this.imports = new ProjectSourceContextImports(root, context, context.source_io);
	}

	/** Responsibilities: _source-relative import resolution_. **/
	public path(file: string, specifier: string): string {
		const importer = resolve(this.root, file);
		const candidate = this.imports.path(importer, specifier);
		if (candidate.length === 0) {
			return "";
		}
		return relative(this.root, candidate).replaceAll("\\", "/");
	}

	/** Responsibilities: _top-level imported declaration paths_. **/
	public declaration_paths(file: string, imports: readonly TestTargetImport[], python: boolean): string[] {
		const importer = resolve(this.root, file);
		const paths: string[] = [];
		for (const item of imports) {
			for (const name of item.names) {
				let candidate = "";
				if (python) {
					candidate = this.python_declaration_path(importer, item.specifier, name);
				} else {
					candidate = this.imports.declaration_path(importer, item.specifier, name);
				}
				if (candidate.length > 0) {
					paths.push(relative(this.root, candidate).replaceAll("\\", "/"));
				}
			}
		}
		return paths;
	}
}
