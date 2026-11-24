import { basename, relative } from "node:path";
import { PYTHON_INDEX_MODULE, TYPESCRIPT_INDEX_MODULE } from "src/constants";
import { PYTHON_PACKAGE_MARKER } from "src/constants";
import type { NormalizedAstFile } from "src/model/ast/normalized_ast_types";
import { DiagnosticRule } from "src/model/diagnostic_rule";
import type { RuleContract } from "src/reporting_protocols";
import type { ViolationContract } from "src/reporting_protocols";

/** Responsibilities: _directory facade classification_, _declaration and re-export validation_. **/
export class DirectoryFacadeRules {
	private readonly _facade_file_names: Set<string>;
	private readonly _facade_rule: RuleContract;

	/** Responsibilities: _selection facade-like files directory_. **/
	private facade_files(source_files: readonly string[]): readonly string[] {
		if (source_files.length === 0) {
			return [];
		}
		if (!source_files.every((file) => this._facade_file_names.has(basename(file)))) {
			return [];
		}
		return source_files;
	}

	/** Responsibilities: _creation facade-file violations normalization_. **/
	private facade_file_violation(file: string, repo_root: string, source_ast: NormalizedAstFile): ViolationContract[] {
		if (!this.declarations(source_ast)) {
			return [];
		}
		return [this._facade_rule.violation(relative(repo_root, file), 1, {})];
	}

	/** Responsibilities: _named declaration detection_. **/
	private has_named_declarations(source_ast: NormalizedAstFile): boolean {
		if (source_ast.source.classes.length > 0) {
			return true;
		}
		if (source_ast.source.functions.length > 0) {
			return true;
		}
		if (source_ast.references.type_declarations.length > 0) {
			return true;
		}
		return source_ast.references.named_symbols.length > 0;
	}

	/** Responsibilities: _reporting normalization AST contains_. **/
	/** Responsibilities: _field initialization_. **/
	public constructor() {
		this._facade_file_names = new Set([PYTHON_PACKAGE_MARKER, TYPESCRIPT_INDEX_MODULE, PYTHON_INDEX_MODULE]);
		this._facade_rule = new DiagnosticRule("facade-file-content");
	}
	/** Responsibilities: _public operation_. **/
	public declarations(ast: NormalizedAstFile): boolean {
		if (this.has_named_declarations(ast)) {
			return true;
		}
		if (ast.control_flow.module_instances.length > 0) {
			return true;
		}
		return ast.module_declarations.module_constant_spans.length > 0;
	}

	/** Responsibilities: _collection facade violations source_. **/
	public facade_violations(
		repo_root: string,
		source_files: readonly string[],
		source_asts: ReadonlyMap<string, NormalizedAstFile>,
	): ViolationContract[] {
		const violations: ViolationContract[] = [];
		for (const file of this.facade_files(source_files)) {
			const ast = source_asts.get(file);
			if (ast !== undefined) {
				violations.push(...this.facade_file_violation(file, repo_root, ast));
			}
		}
		return violations;
	}
}
