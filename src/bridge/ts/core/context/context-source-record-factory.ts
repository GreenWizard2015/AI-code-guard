import { relative } from 'node:path';
import { extname } from 'node:path';
import ts from 'typescript';
import { LintFileName } from 'src/bridge/ts/core/context/file-name';
import type { LintSourceRecord, LintRunStatistics, NormalizedAstFile } from 'src/types';
import { TypeScriptAstFile } from 'src/model/typescript-ast';
import type { TypeScriptAstOptions } from 'src/model/types';
import { TypeScriptLintSourceRecord } from 'src/bridge/ts/core/context/typescript-lint-source-record';
import { PythonLintSourceRecord } from 'src/bridge/ts/core/context/python-lint-source-record';

/** Responsibilities: _classification source languages construction_. **/
export class ContextSourceRecordSet {
	private readonly typescript_extensions = ['.ts', '.tsx'];

	/** Responsibilities: _TypeScript source paths classification_. **/
	private typescript(file: string): boolean {
		const extension = extname(file);
		if (extension.length === 0) {
			return false;
		}
		return this.typescript_extensions.includes(extension);
	}

	/** Responsibilities: _retrieval source text file_. **/
	private source_text(texts: ReadonlyMap<string, string>, file: string): string {
		const text = texts.get(file);
		if (text === undefined) {
			return '';
		}
		return text;
	}

	/** Responsibilities: _resolution parsing TypeScript source_. **/
	private source_resolver(
		source_files: ReadonlyMap<string, ts.SourceFile>
	): (file: string) => ts.SourceFile[] {
		return file => {
			const source = source_files.get(file);
			if (source === undefined) {
				return [];
			}
			return [source];
		};
	}

	/** Responsibilities: _selection TypeScript parser mode_. **/
	private script_kind(file: string): ts.ScriptKind {
		if (file.endsWith('.tsx')) {
			return ts.ScriptKind.TSX;
		}
		return ts.ScriptKind.TS;
	}

	/** Responsibilities: _creation reuse TypeScript AST_. **/
	private create_typescript_ast(
		file: string,
		text: string,
		source_files: ReadonlyMap<string, ts.SourceFile>
	): TypeScriptAstFile {
		let source_file = source_files.get(file);
		if (source_file === undefined) {
			source_file = ts.createSourceFile(
				file,
				text,
				ts.ScriptTarget.Latest,
				true,
				this.script_kind(file)
			);
		}
		const options: TypeScriptAstOptions = {
			source_file,
			source_resolver: this.source_resolver(source_files),
		};
		return new TypeScriptAstFile(file, text, options);
	}

	/** Responsibilities: _retrieval normalization Python AST_. **/
	private python_ast_for(
		python_file_asts: ReadonlyMap<string, NormalizedAstFile>,
		file: string
	): NormalizedAstFile {
		const ast = python_file_asts.get(file);
		if (ast === undefined) {
			throw new Error(`Python AST is missing for ${file}.`);
		}
		return ast;
	}

	/** Responsibilities: _validation retrieval Python AST_. **/
	private python_ast_argument(
		file: string,
		python_file_asts: ReadonlyMap<string, NormalizedAstFile>
	): NormalizedAstFile {
		if (this.typescript(file)) {
			throw new Error(`Python AST was requested for TypeScript file ${file}.`);
		}
		return this.python_ast_for(python_file_asts, file);
	}

	/** Responsibilities: _construction TypeScript lint source_. **/
	private typescript_source_record(
		file: string,
		relative_path: string,
		file_name: LintFileName,
		text: string,
		typescript_ast: TypeScriptAstFile
	): LintSourceRecord {
		return new TypeScriptLintSourceRecord(
			{ absolute_path: file, relative_path, file_name, text, normalized_ast: typescript_ast.normalized() },
			typescript_ast
		);
	}

	/** Responsibilities: _construction Python lint source_. **/
	private python_source_record(
		file: string,
		relative_path: string,
		file_name: LintFileName,
		text: string,
		python_ast: NormalizedAstFile
	): LintSourceRecord {
		return new PythonLintSourceRecord({
			absolute_path: file,
			relative_path,
			file_name,
			text,
			normalized_ast: python_ast,
		});
	}

	/** Responsibilities: _normalization source path construction_. **/
	public source_record(
		repo_root: string,
		file: string,
		text: string,
		source_files: ReadonlyMap<string, ts.SourceFile>,
		python_file_asts: ReadonlyMap<string, NormalizedAstFile>
	): LintSourceRecord {
		const relative_path = relative(repo_root, file).split('\\').join('/');
		const file_name = new LintFileName(relative_path);
		if (this.typescript(file)) {
			const typescript_ast = this.create_typescript_ast(file, text, source_files);
			return this.typescript_source_record(file, relative_path, file_name, text, typescript_ast);
		}
		return this.python_source_record(
			file,
			relative_path,
			file_name,
			text,
			this.python_ast_argument(file, python_file_asts)
		);
	}

	/** Responsibilities: _construction source records requested_. **/
	public source_records(
		repo_root: string,
		files: string[],
		texts: ReadonlyMap<string, string>,
		source_files: ReadonlyMap<string, ts.SourceFile>,
		python_file_asts: ReadonlyMap<string, NormalizedAstFile>
	): LintSourceRecord[] {
		return files.map(file => this.source_record(
			repo_root,
			file,
			this.source_text(texts, file),
			source_files,
			python_file_asts
		));
	}

	/** Responsibilities: _summary source reading parser_. **/
	public statistics(
		files: readonly string[],
		source_files: ReadonlyMap<string, ts.SourceFile>
	): LintRunStatistics {
		return {
			source_reads: files.length,
			typescript_parses: source_files.size,
			python_parses: files.filter(file => file.endsWith('.py')).length,
			source_records: files.length,
		};
	}
}
