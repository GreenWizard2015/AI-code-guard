import { TEST_PATH_SUFFIXES } from "src/constants";
import { ProjectSourcePython } from "src/core/project-source/project_source_python";
import { PythonCompositionImports } from "src/linting/composition/python_composition_imports";
import { PythonClassOwnership } from "src/linting/orchestration/runtime/python/class-ownership/python_class_ownership";
import { PythonClassReference } from "src/linting/orchestration/runtime/python/class-ownership/python_class_reference";
import { PythonAstFileRuleCollector } from "src/linting/orchestration/runtime/python/coding_rules/python_ast_file_rule_collector";
import { PythonCollaboratorScanner } from "src/linting/orchestration/runtime/python/python_collaborator_scanner";
import type { AstClassNode, NormalizedAstFile } from "src/model/ast/normalized_ast_types";
import type { ViolationContract } from "src/reporting_protocols";
import type { LintStageTimerContract } from "src/shared_services_protocols";
import type { TestPathSyntaxContract } from "src/shared_services_protocols";
import type { ProjectSourcePythonContract } from "src/source_protocols";
import type { LintSourceRecordData } from "src/source_types";
import { TestPathSyntax } from "src/test_path_syntax";
import { TestPathKind } from "src/types";

import type { PythonLintInput, PythonProjectNames } from "src/model_types";

/** Responsibilities: _Python rule registration_, _project symbol resolution_. **/
export class PythonScanner {
	private readonly _class_ownership: PythonClassOwnership;
	private readonly _source_imports: ProjectSourcePythonContract;
	private readonly _source_asts: ReadonlyMap<string, NormalizedAstFile>;
	private readonly _import_resolver: PythonCompositionImports;
	private readonly _test_path_syntax: TestPathSyntaxContract;
	private readonly _collaborator_scanner: PythonCollaboratorScanner;

	/** Responsibilities: _creation Python rule collectors_. **/
	private create_python_rules(
		source_file: string,
		project_class_names: ReadonlySet<string>,
		project_protocol_names: ReadonlySet<string>,
		normalized_ast: NormalizedAstFile,
	): NormalizedAstFile {
		const ast: NormalizedAstFile = {
			...normalized_ast,
			source: { ...normalized_ast.source, classes: [...normalized_ast.source.classes] },
		};
		this.mark_external_bases(source_file, ast, ast.source.classes, project_class_names);
		this.mark_protocol_implementations(source_file, ast, ast.source.classes, project_protocol_names);
		return ast;
	}

	/** Responsibilities: _Python external inheritance_. **/
	private mark_external_bases(
		file: string,
		ast: NormalizedAstFile,
		classes: AstClassNode[],
		fallback: ReadonlySet<string>,
	): void {
		for (const [index, class_node] of classes.entries()) {
			const base_names = class_node.structure.base_class_names;
			classes[index] = {
				...class_node,
				classification: {
					...class_node.classification,
					extends_external_class: base_names.some((base) => {
						const reference = new PythonClassReference(this._class_ownership, file, ast, base, fallback);
						return !reference.project_class();
					}),
				},
			};
		}
	}

	/** Responsibilities: _marking protocol implementations Python_. **/
	private mark_protocol_implementations(
		file: string,
		ast: NormalizedAstFile,
		classes: AstClassNode[],
		fallback: ReadonlySet<string>,
	): void {
		for (const [index, class_node] of classes.entries()) {
			const base_names = class_node.structure.base_class_names;
			const interfaces = base_names.filter((base_name) => {
				const reference = new PythonClassReference(this._class_ownership, file, ast, base_name, fallback);
				return reference.project_protocol();
			});
			if (interfaces.length > 0) {
				classes[index] = {
					...class_node,
					structure: { ...class_node.structure, interfaces },
				};
			}
		}
	}

	/** Responsibilities: _Python target function identification_. **/
	private is_imported_function(target: NormalizedAstFile, name: string): boolean {
		for (const node of target.source.functions) {
			if (node.identity.name !== name) {
				continue;
			}
			if (node.identity.owner !== undefined && node.identity.owner.length > 0) {
				continue;
			}
			if (node.identity.nested) {
				continue;
			}
			return true;
		}
		return false;
	}

	/** Responsibilities: _Python import target identification_. **/
	private is_production_import(target_file: string, name: string): boolean {
		if (this._test_path_syntax.classify(target_file).has(TestPathKind.TestFile)) {
			return false;
		}
		const target = this._source_asts.get(target_file);
		if (target === undefined) {
			return false;
		}
		if (target.source.classes.some((node) => node.identity.name === name)) {
			return true;
		}
		return this.is_imported_function(target, name);
	}

	/** Responsibilities: _production import-name indexing_. **/
	private production_import_names(source_file: string): ReadonlySet<string> {
		const ast = this._source_asts.get(source_file);
		if (ast === undefined) {
			return new Set<string>();
		}
		const names = new Set<string>();
		for (const [local_name, target] of this._import_resolver.python_imports(source_file, ast.source.python_imports)) {
			if (this.is_production_import(target.file, target.name)) {
				names.add(local_name);
			}
		}
		return names;
	}

	/** Responsibilities: _Python scanner initialization_. **/
	public constructor(root: string, sources: readonly LintSourceRecordData[], stage_timer: LintStageTimerContract) {
		this._source_imports = new ProjectSourcePython(root);
		this._test_path_syntax = new TestPathSyntax(TEST_PATH_SUFFIXES);
		const source_asts = new Map(
			sources
				.filter((source) => source.language === "python")
				.map((source) => [source.absolute_path, source.normalized_ast] as const),
		);
		this._source_asts = source_asts;
		this._import_resolver = new PythonCompositionImports(
			{ root, files: new Set(sources.map((source) => source.absolute_path)), resolver: this._source_imports },
			source_asts,
		);
		this._collaborator_scanner = new PythonCollaboratorScanner({
			source_asts,
			import_resolver: this._import_resolver,
			test_path_syntax: this._test_path_syntax,
		});
		stage_timer.measure("rule.concrete-collaborator-created-per-operation.python.prepare", () =>
			this._collaborator_scanner.prepare(),
		);
		this._class_ownership = new PythonClassOwnership({
			export_symbols: this._import_resolver,
			project_imports: this._source_imports,
			sources,
		});
	}

	/** Responsibilities: _public operation_. **/
	public project_names(input: PythonLintInput): PythonProjectNames {
		return {
			project_class_names: input.python_class_names,
			project_protocol_names: input.project_protocol_names,
			project_type_names: input.project_type_names,
			project_alias_names: input.project_alias_names,
		};
	}

	/** Responsibilities: _lint Python file output_. **/
	public lint_python_file(input: PythonLintInput, stage_timer: LintStageTimerContract): ViolationContract[] {
		const names = this.project_names(input);
		const normalized_ast = input.normalized_ast;
		const ast = this.create_python_rules(
			input.source_file,
			names.project_class_names,
			names.project_protocol_names,
			normalized_ast,
		);
		const production_import_names = this.production_import_names(input.source_file);
		const collector = new PythonAstFileRuleCollector(input, ast, production_import_names, stage_timer);
		const violations = collector.collect_violations();
		const collaborator_violations = stage_timer.measure(
			"rule.concrete-collaborator-created-per-operation.python-project",
			() => this._collaborator_scanner.violations(input),
		);
		return [...violations, ...collaborator_violations];
	}
}
