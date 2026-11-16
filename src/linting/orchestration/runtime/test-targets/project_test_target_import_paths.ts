import { relative, resolve } from "node:path";
import { TEST_PATH_SUFFIXES } from "src/constants";
import { ProjectSourceContextImports } from "src/core/project-source/project_source_context_imports";
import { FileSystemTestPathChecker } from "src/linting/orchestration/runtime/test-targets/file_system_test_path_checker";
import { TestFileOrganization } from "src/linting/orchestration/runtime/test-targets/test_file_organization";
import { TestTargetImports } from "src/linting/orchestration/runtime/test-targets/test_target_imports";
import { TestTargetSource } from "src/linting/orchestration/runtime/test-targets/test_target_source";
import type { NormalizedAstSource, TestTargetImport } from "src/model/ast/normalized_ast_types";
import type { LintProjectContextContract } from "src/shared_services_protocols";
import type { ProjectSourceContextImportsContract } from "src/source_protocols";
import type { LintSourceRecordData } from "src/source_types";
import type { TestTargetLink } from "src/task_types";
import { TestPathSyntax } from "src/test_path_syntax";
import type {
	TestFileOrganizationContract,
	TestTargetImportResolverContract,
	TestTargetImportsContract,
} from "src/testing_protocols";
import { TestPathKind } from "src/types";

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

	/** Responsibilities: _language-specific test imports_. **/
	private production_imports(source: LintSourceRecordData, parser: TestTargetImportsContract): TestTargetImport[] {
		if (source.language === "python") {
			return parser.production_python(source.normalized_ast.source.python_imports, source.text);
		}
		return parser.production_typescript(source.typescript_ast.source_file_node());
	}

	/** Responsibilities: _resolver-confirmed target links_. **/
	private append_target_link(
		source: LintSourceRecordData,
		imports: readonly TestTargetImport[],
		organization: TestFileOrganizationContract,
		links: TestTargetLink[],
	): void {
		if (imports.length === 0) {
			return;
		}
		const target_source = new TestTargetSource(
			source.relative_path,
			imports,
			source.language === "python",
			this._root,
			organization,
		);
		const production_files = target_source.matching_target_paths(this);
		production_files.sort();
		if (production_files.length > 0) {
			links.push({ test_file: source.relative_path, production_files });
		}
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

	/** Responsibilities: _resolver-confirmed test target links_. **/
	public test_target_links(): TestTargetLink[] {
		const sources = this._context.files();
		const source_paths = sources.map((source) => source.relative_path);
		const organization = new TestFileOrganization(this._root, new FileSystemTestPathChecker(this._root, source_paths));
		const path_syntax = new TestPathSyntax(TEST_PATH_SUFFIXES);
		const links: TestTargetLink[] = [];
		for (const source of sources) {
			if (!path_syntax.classify(source.relative_path).has(TestPathKind.TestFile)) {
				continue;
			}
			const parser = new TestTargetImports();
			const imports = this.production_imports(source, parser);
			this.append_target_link(source, imports, organization, links);
		}
		return links.sort((left, right) => left.test_file.localeCompare(right.test_file));
	}
}
