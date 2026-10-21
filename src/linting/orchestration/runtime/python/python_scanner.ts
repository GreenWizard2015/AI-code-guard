import type { ProjectSourcePythonContract } from "src/source_protocols";
import type { ViolationContract } from "src/reporting_protocols";
import type { LintSourceRecord } from "src/source_types";
import type { AstClassNodeContract, NormalizedAstFileContract } from "src/types";
import { PythonAstFileRuleCollector } from "src/linting/orchestration/runtime/python/python_ast_file_rule_collector";
import { PythonClassOwnership } from "src/linting/orchestration/runtime/python/python_class_ownership";
import { ProjectSourcePython } from "src/core/project-source/project_source_python";
import { PythonCompositionImports } from "src/linting/orchestration/runtime/composition/python_composition_imports";
import { TestPathSyntax } from "src/test_path_syntax";

import type { PythonLintInput, PythonProjectNames } from "src/model/types/types";

/** Responsibilities: _Python rule registration_, _project symbol resolution_. **/
export class PythonScanner {
	private readonly class_ownership: PythonClassOwnership;
	private readonly source_imports: ProjectSourcePythonContract;
	private readonly source_asts: ReadonlyMap<string, NormalizedAstFileContract>;
	private readonly import_resolver: PythonCompositionImports;
	private readonly test_path_syntax: TestPathSyntax;

	/** Responsibilities: _creation Python rule collectors_. **/
	private create_python_rules(
		source_file: string,
		project_class_names: ReadonlySet<string>,
		project_protocol_names: ReadonlySet<string>,
		normalized_ast: NormalizedAstFileContract,
	): NormalizedAstFileContract {
		const ast = structuredClone(normalized_ast);
		this.mark_external_bases(source_file, ast, ast.classes, project_class_names);
		this.mark_protocol_implementations(source_file, ast, ast.classes, project_protocol_names);
		return ast;
	}

	/** Responsibilities: _Python external inheritance_. **/
	private mark_external_bases(
		file: string,
		ast: NormalizedAstFileContract,
		classes: AstClassNodeContract[],
		fallback: ReadonlySet<string>,
	): void {
		for (let index = 0; index < classes.length; index += 1) {
			const class_node = classes[index];
			const base_names = class_node.base_class_names;
			classes[index] = { ...class_node, extends_external_class: base_names.some(
				(base) => !this.class_ownership.project_class(file, ast, base, fallback, this.source_imports),
			) };
		}
	}

	/** Responsibilities: _marking protocol implementations Python_. **/
	private mark_protocol_implementations(
		file: string,
		ast: NormalizedAstFileContract,
		classes: AstClassNodeContract[],
		fallback: ReadonlySet<string>,
	): void {
		for (let index = 0; index < classes.length; index += 1) {
			const class_node = classes[index];
			let base_names: readonly string[] = [];
			if (class_node.base_class_names !== undefined) {
				base_names = class_node.base_class_names;
			}
			const interfaces = base_names.filter((base_name) =>
				this.class_ownership.project_protocol(file, ast, base_name, fallback, this.source_imports),
			);
			if (interfaces.length > 0) {
				classes[index] = { ...class_node, interfaces };
			}
		}
	}

	/** Responsibilities: _Python target function identification_. **/
	private is_imported_function(target: NormalizedAstFileContract, name: string): boolean {
		for (const node of target.functions) {
			if (node.name !== name) {
				continue;
			}
			if (node.owner !== undefined && node.owner.length > 0) {
				continue;
			}
			if (node.nested) {
				continue;
			}
			return true;
		}
		return false;
	}

	/** Responsibilities: _Python import target identification_. **/
	private is_production_import(target_file: string, name: string): boolean {
		if (this.test_path_syntax.test_file(target_file)) {
			return false;
		}
		const target = this.source_asts.get(target_file);
		if (target === undefined) {
			return false;
		}
		if (target.classes.some((node) => node.name === name)) {
			return true;
		}
		return this.is_imported_function(target, name);
	}

	/** Responsibilities: _production import-name indexing_. **/
	private production_import_names(source_file: string, ast: NormalizedAstFileContract): ReadonlySet<string> {
		const names = new Set<string>();
		for (const [local_name, target] of this.import_resolver.python_imports(source_file, ast.python_imports)) {
			if (this.is_production_import(target.file, target.name)) {
				names.add(local_name);
			}
		}
		return names;
	}

	/** Responsibilities: _Python scanner initialization_. **/
	public constructor(root = "", sources: readonly LintSourceRecord[] = []) {
		this.source_imports = new ProjectSourcePython();
		this.test_path_syntax = new TestPathSyntax();
		const source_asts = new Map(
			sources
				.filter((source) => source.python())
				.map((source) => [source.absolute_path, source.normalized_ast] as const),
		);
		this.source_asts = source_asts;
		this.import_resolver = new PythonCompositionImports(
			{ root, files: new Set(sources.map((source) => source.absolute_path)), resolver: this.source_imports },
			source_asts,
		);
		this.class_ownership = new PythonClassOwnership(root, this.import_resolver);
		this.class_ownership.register_sources(sources);
	}
	/** Responsibilities: _public operation_. **/
	public project_names(input: PythonLintInput): PythonProjectNames {
		return {
			project_class_names: input.python_class_names,
			project_protocol_names: input.project_protocol_names,
			project_type_names: input.project_type_names,
		};
	}

	/** Responsibilities: _lint Python file output_. **/
	public lint_python_file(input: PythonLintInput): ViolationContract[] {
		const names = this.project_names(input);
		const normalized_ast = input.normalized_ast;
		const ast = this.create_python_rules(
			input.source_file,
			names.project_class_names,
			names.project_protocol_names,
			normalized_ast,
		);
		const production_import_names = this.production_import_names(input.source_file, ast);
		const collector = new PythonAstFileRuleCollector(input, ast, production_import_names);
		return collector.collect_violations();
	}
}
