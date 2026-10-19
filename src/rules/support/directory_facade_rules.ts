import { basename, relative } from "node:path";
import { DiagnosticRule } from "src/model/diagnostic_rule";
import type { ViolationContract } from "src/protocols";
import type { NormalizedAstFile } from "src/types";
import { PYTHON_INDEX_MODULE, TYPESCRIPT_INDEX_MODULE } from "src/constants";
import { PYTHON_PACKAGE_MARKER } from "src/constants";

/** Responsibilities: _directory facade classification_, _declaration and re-export validation_. **/
export class DirectoryFacadeRules {
	private readonly facade_file_names: Set<string>;
	private readonly facade_rule: DiagnosticRule;

	/** Responsibilities: _selection facade-like files directory_. **/
	private facade_files(source_files: readonly string[]): readonly string[] {
		if (source_files.length === 0) {
			return [];
		}
		if (!source_files.every((file) => this.facade_file_names.has(basename(file)))) {
			return [];
		}
		return source_files;
	}

	/** Responsibilities: _creation facade-file violations normalization_. **/
	private facade_file_violation(file: string, repo_root: string, ast: NormalizedAstFile): ViolationContract[] {
		if (!this.declarations(ast)) {
			return [];
		}
		return [this.facade_rule.violation(relative(repo_root, file), 1)];
	}

	/** Responsibilities: _named declaration detection_. **/
	private has_named_declarations(ast: NormalizedAstFile): boolean {
		if (ast.classes.length > 0) {
			return true;
		}
		if (ast.functions.length > 0) {
			return true;
		}
		if (ast.type_declarations.length > 0) {
			return true;
		}
		return ast.named_symbols.length > 0;
	}

	/** Responsibilities: _reporting normalization AST contains_. **/
	/** Responsibilities: _field initialization_. **/
	constructor() {
		this.facade_file_names = new Set([PYTHON_PACKAGE_MARKER, TYPESCRIPT_INDEX_MODULE, PYTHON_INDEX_MODULE]);
		this.facade_rule = new DiagnosticRule("facade-file-content");
	}
	/** Responsibilities: _public operation_. **/
	public declarations(ast: NormalizedAstFile): boolean {
		if (this.has_named_declarations(ast)) {
			return true;
		}
		if (ast.module_instances.length > 0) {
			return true;
		}
		return ast.module_constant_spans.length > 0;
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
