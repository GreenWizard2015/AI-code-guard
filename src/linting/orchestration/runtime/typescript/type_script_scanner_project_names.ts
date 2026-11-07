import { TypeScriptImportBindingCollector } from "src/linting/orchestration/runtime/typescript/type_script_import_binding_collector";
import type { AstClassNode, NormalizedAstFile } from "src/model/ast/normalized_ast_types";
import type { TypeScriptScannerOptions } from "src/model_types";
import type { ProjectNameMembershipContract, ProjectNameSetContract } from "src/source_protocols";
import type { TypeScriptAstFileContract } from "src/typescript_runtime_protocols";
import ts from "typescript";

/** Responsibilities: _project name collection_, _external import filtering_. **/
export class TypeScriptScannerProjectNames implements ProjectNameMembershipContract {
	private readonly _options: TypeScriptScannerOptions;
	private readonly _project_names: ProjectNameSetContract;
	private readonly _additions: Set<string>;
	private readonly _exclusions: Set<string>;
	private readonly _source_file: ts.SourceFile;
	private readonly _classes: readonly AstClassNode[];

	/** Responsibilities: _project namespace base collection_. **/
	private append_namespace_bases(module_path: string, namespace: string, additions: Set<string>): void {
		const { module_resolver, project_files } = this._options.module_scope;
		const prefix = `${namespace}.`;
		for (const class_node of this._classes) {
			for (const base of class_node.structure.base_class_names) {
				if (!base.startsWith(prefix)) {
					continue;
				}
				const imported_name = base.slice(prefix.length);
				const resolved = module_resolver.resolve({ file: module_path, name: imported_name });
				if (project_files.has(resolved.file)) {
					additions.add(base);
				}
			}
		}
	}

	/** Responsibilities: _import binding index_. **/
	private append_import(
		statement: ts.ImportDeclaration,
		module_path: string,
		additions: Set<string>,
		exclusions: Set<string>,
	): void {
		const collector = new TypeScriptImportBindingCollector(statement, this._options, module_path);
		collector.collect();
		collector.append_to(additions, exclusions);
		const namespace = statement.importClause?.namedBindings;
		if (namespace === undefined || !ts.isNamespaceImport(namespace)) {
			return;
		}
		const { project_files } = this._options.module_scope;
		if (!project_files.has(module_path)) {
			return;
		}
		this.append_namespace_bases(module_path, namespace.name.text, additions);
	}

	/** Responsibilities: _project-name synchronization_. **/
	private apply_import_names(additions: ReadonlySet<string>, exclusions: ReadonlySet<string>): void {
		for (const name of additions) {
			this._exclusions.delete(name);
			this._additions.add(name);
		}
		for (const name of exclusions) {
			this._additions.delete(name);
			this._exclusions.add(name);
		}
	}

	/** Responsibilities: _project name index initialization_. **/
	public constructor(
		options: TypeScriptScannerOptions,
		ast_file: TypeScriptAstFileContract,
		ast: NormalizedAstFile,
		project_names: ProjectNameSetContract,
	) {
		this._options = options;
		this._project_names = project_names;
		this._additions = new Set<string>();
		this._exclusions = new Set<string>();
		this._source_file = ast_file.source_file_node();
		this._classes = ast.source.classes;
	}

	/** Responsibilities: _project name membership_. **/
	public contains(name: string): boolean {
		if (this._exclusions.has(name)) {
			return false;
		}
		if (this._additions.has(name)) {
			return true;
		}
		return this._project_names.has(name);
	}

	/** Responsibilities: _project import name collection_, _external import filtering_. **/
	public collect(): void {
		const additions = new Set<string>();
		const exclusions = new Set<string>();
		const { module_resolver } = this._options.module_scope;
		for (const statement of this._source_file.statements) {
			if (!ts.isImportDeclaration(statement) || !ts.isStringLiteral(statement.moduleSpecifier)) {
				continue;
			}
			const module_path = module_resolver.module_symbol(this._source_file.fileName, statement.moduleSpecifier.text);
			if (statement.importClause !== undefined) {
				this.append_import(statement, module_path, additions, exclusions);
			}
		}
		this.apply_import_names(additions, exclusions);
	}
}
