import { basename, dirname, relative } from 'node:path';
import type { Violation } from 'src/protocols';
import { DiagnosticRule } from 'src/model/diagnostic-rule';
import type { NormalizedAstFile } from 'src/types';

/** Responsibilities: _identification facade files direct_. **/
export class DirectoryFacadeRules {
	private readonly facade_file_names = new Set(['__init__.py', 'index.ts', 'index.py']);
	private readonly facade_rule = new DiagnosticRule('facade-file-content');

	/** Responsibilities: _selection source files directly_. **/
	private direct_source_files(files: string[], directory: string): string[] {
		const source_files: string[] = [];
		for (const file of files) {
if (dirname(file) === directory && (file.endsWith('.ts') || file.endsWith('.py'))) {
				source_files.push(file);
			}
		}
		return source_files;
	}

	/** Responsibilities: _selection facade-like files directory_. **/
	private facade_files(files: string[], directory: string): string[] {
		const source_files = this.direct_source_files(files, directory);
if (source_files.length === 0 || !source_files.every(file => this.facade_file_names.has(basename(file)))) {
			return [];
		}
		return source_files;
	}

	/** Responsibilities: _creation facade-file violations normalization_. **/
	private facade_file_violation(file: string, repo_root: string, ast: NormalizedAstFile): Violation[] {
		if (!this.declarations(ast)) {
			return [];
		}
		return [this.facade_rule.violation(relative(repo_root, file), 1)];
	}

	/** Responsibilities: _reporting normalization AST contains_. **/
	public declarations(ast: NormalizedAstFile): boolean {
if (ast.classes.length > 0 || ast.functions.length > 0 || ast.type_declarations.length > 0) {
			return true;
		}
if (ast.named_symbols.length > 0 || ast.module_instances?.length) {
			return true;
		}
		return ast.module_constant_spans.length > 0;
	}

	/** Responsibilities: _collection facade violations source_. **/
	public facade_violations(
		directory: string,
		repo_root: string,
		files: string[],
		source_asts: ReadonlyMap<string, NormalizedAstFile>
	): Violation[] {
		const violations: Violation[] = [];
		for (const file of this.facade_files(files, directory)) {
			const ast = source_asts.get(file);
			if (ast !== undefined) {
				violations.push(...this.facade_file_violation(file, repo_root, ast));
			}
		}
		return violations;
	}
}
