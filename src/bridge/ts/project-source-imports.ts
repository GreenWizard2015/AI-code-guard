import { ProjectSourcePython } from 'src/project-source-python';
import { PythonAstData } from 'src/bridge/ts/core/python-ast-parser';
import { readFileSync } from 'node:fs';
import { resolve, dirname, extname } from 'node:path';
import ts from 'typescript';
import type { LintProjectContext } from 'src/protocols';
import type { NormalizedAstFile } from 'src/types';

/** Responsibilities: _extraction normalization resolution TypeScript_. **/
export class ProjectSourceImports {
	private readonly python_extension = '.py';
	private readonly project_source_python = new ProjectSourcePython();

	/** Responsibilities: _retrieval parsing TypeScript source_. **/
	private context_source_file(file: string, context: LintProjectContext): ts.SourceFile {
		const source = context.source_record(file);
		if (source.typescript()) {
			return source.typescript_ast.source_file;
		}
		return ts.createSourceFile(file, readFileSync(file, 'utf8'), ts.ScriptTarget.Latest, true);
	}

	/** Responsibilities: _collection module specifiers TypeScript_. **/
	private typescript_imports(source_file: ts.SourceFile): string[] {
		const imports: string[] = [];
		source_file.forEachChild(node => {
			let specifier: ts.Expression | undefined;
if (ts.isImportDeclaration(node) || ts.isExportDeclaration(node)) {
				specifier = node.moduleSpecifier;
			}
			if (specifier !== undefined && ts.isStringLiteral(specifier)) {
				imports.push(specifier.text);
			}
		});
		return imports;
	}

	/** Responsibilities: _resolution TypeScript import specifier_. **/
	private resolve_typescript_import(root: string, importer: string, specifier: string, files: Set<string>): string {
		if (specifier.startsWith('.')) {
			return this.project_source_python.select_import_candidate(resolve(dirname(importer), specifier), files);
		}
		const root_candidate = this.project_source_python.select_import_candidate(resolve(root, specifier), files);
		if (root_candidate.length > 0) {
			return root_candidate;
		}
		return this.project_source_python.select_import_candidate(resolve(root, 'src', specifier), files);
	}

	/** Responsibilities: _classification source path Python_. **/
	private is_python_file(file: string, ...contexts: LintProjectContext[]): boolean {
		const context = contexts[0];
		const record = context?.source_record(file);
		if (record !== undefined) {
			return record.language === 'python';
		}
		return extname(file) === this.python_extension;
	}

	/** Responsibilities: _collection module specifiers normalization_. **/
	private python_import_specifiers(ast: NormalizedAstFile): string[] {
		let imports = ast.python_imports;
		if (imports === undefined) {
			imports = [];
		}
		return imports.map(item => item.module);
	}

	/** Responsibilities: _extraction import specifiers directly_. **/
	public import_specifiers(file: string): string[] {
		const python_ast_parser = new PythonAstData();
		if (extname(file) === this.python_extension) {
			return this.python_import_specifiers(python_ast_parser.source_ast(readFileSync(file, 'utf8')));
		}
		return this.typescript_imports(ts.createSourceFile(file, readFileSync(file, 'utf8'), ts.ScriptTarget.Latest, true));
	}

	/** Responsibilities: _extraction import specifiers usage_. **/
	public context_import_specifiers(file: string, context: LintProjectContext): string[] {
		const record = context.source_record(file);
		if (record.language === 'python') {
			return this.python_import_specifiers(record.normalized_ast);
		}
		return this.typescript_imports(this.context_source_file(file, context));
	}

	/** Responsibilities: _resolution direct import specifier_. **/
	public specifier_path(root: string, file: string, specifier: string, files: Set<string>): string {
		if (this.is_python_file(file)) {
			return this.project_source_python.python_import_path(root, file, specifier, files);
		}
		return this.resolve_typescript_import(root, file, specifier, files);
	}

	/** Responsibilities: _resolution import specifier usage_. **/
	public context_specifier_path(root: string, file: string, specifier: string, files: Set<string>, context: LintProjectContext): string {
		if (this.is_python_file(file, context)) {
			return this.project_source_python.python_import_path(root, file, specifier, files);
		}
		return this.resolve_typescript_import(root, file, specifier, files);
	}

}
