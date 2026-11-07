import {
	PYTHON_AST_SPLIT_BATCH_CLEANUP_UNAVAILABLE_MESSAGE,
	PYTHON_AST_SPLIT_BATCH_COMPLETION_UNAVAILABLE_MESSAGE,
	PYTHON_AST_STAGE_PREFIX,
} from "src/core/python-ast/constants";
import type { NormalizedAstFile, PythonSourceAstBatch } from "src/model/ast/normalized_ast_types";
import type { PythonAstDataContract, PythonSourceFilesContract } from "src/python_protocols";
import type { LintStageTimerContract } from "src/shared_services_protocols";

/** Responsibilities: _Python sources selection_, _batch-parse Python AST files_. **/
export class PythonSourceFiles implements PythonSourceFilesContract {
	private readonly _files: readonly string[];
	private readonly _texts: ReadonlyMap<string, string>;
	private readonly _python_ast_parser: PythonAstDataContract;
	private readonly _repo_root: string;

	/** Responsibilities: _Python source text collection_. **/
	private source_texts(text_source_files: readonly string[]): string[] {
		return text_source_files.map((file) => {
			const text = this._texts.get(file);
			if (text === undefined) {
				return "";
			}
			return text;
		});
	}

	/** Responsibilities: _Python AST batch parsing_. **/
	private parsed_asts(
		ast_parse_files: readonly string[],
		texts: readonly string[],
		full_parse_timer: LintStageTimerContract,
		stage_prefix: string,
	): NormalizedAstFile[] {
		return this._python_ast_parser.batch_ast({
			texts,
			stage_timer: full_parse_timer,
			stage_prefix,
			files: ast_parse_files,
			repo_root: this._repo_root,
		});
	}

	/** Responsibilities: _Python AST file mapping_. **/
	private ast_records(
		record_source_files: readonly string[],
		asts: readonly NormalizedAstFile[],
	): ReadonlyMap<string, NormalizedAstFile> {
		const result = new Map<string, NormalizedAstFile>();
		for (const [index, file] of record_source_files.entries()) {
			const ast = asts[index];
			if (ast === undefined) {
				throw new Error(`Python AST is missing for ${file}.`);
			}
			result.set(file, ast);
		}
		return result;
	}

	/** Responsibilities: _initialization Python source paths_, _parser initialization_. **/
	public constructor(
		files: readonly string[],
		texts: ReadonlyMap<string, string>,
		parser: PythonAstDataContract,
		repo_root = "",
	) {
		this._files = files;
		this._texts = texts;
		this._python_ast_parser = parser;
		this._repo_root = repo_root;
	}

	/** Responsibilities: _Python source files identification_. **/
	public supports(file: string): boolean {
		return file.toLowerCase().endsWith(".py");
	}

	/** Responsibilities: _Python source batch beginning_. **/
	public begin_source_ast(batch_start_timer: LintStageTimerContract, stage_prefix = ""): PythonSourceAstBatch {
		const begin_batch = this._python_ast_parser.begin_batch_ast;
		if (begin_batch === undefined) {
			return { files: [], batch_id: "" };
		}
		let resolved_stage_prefix = PYTHON_AST_STAGE_PREFIX;
		if (stage_prefix.length > 0) {
			resolved_stage_prefix = stage_prefix;
		}
		const files = this._files.filter((file) => this.supports(file));
		const batch_id = begin_batch.call(this._python_ast_parser, {
			texts: this.source_texts(files),
			stage_timer: batch_start_timer,
			stage_prefix: resolved_stage_prefix,
			files,
			repo_root: this._repo_root,
		});
		return { files, batch_id };
	}

	/** Responsibilities: _Python source batch completion_. **/
	public complete_source_ast(batch: PythonSourceAstBatch): ReadonlyMap<string, NormalizedAstFile> {
		const complete_batch = this._python_ast_parser.complete_batch_ast;
		if (complete_batch === undefined) {
			throw new Error(PYTHON_AST_SPLIT_BATCH_COMPLETION_UNAVAILABLE_MESSAGE);
		}
		return this.ast_records(batch.files, complete_batch.call(this._python_ast_parser, batch.batch_id));
	}

	/** Responsibilities: _source batch cleanup_. **/
	public cancel_source_ast(batch: PythonSourceAstBatch): void {
		if (batch.batch_id.length === 0) {
			return;
		}
		const cancel_batch = this._python_ast_parser.cancel_batch_ast;
		if (cancel_batch !== undefined) {
			cancel_batch.call(this._python_ast_parser, batch.batch_id);
			return;
		}
		const complete_batch = this._python_ast_parser.complete_batch_ast;
		if (complete_batch === undefined) {
			throw new Error(PYTHON_AST_SPLIT_BATCH_CLEANUP_UNAVAILABLE_MESSAGE);
		}
		complete_batch.call(this._python_ast_parser, batch.batch_id);
	}

	/** Responsibilities: _batch-parse supported Python sources_. **/
	public source_ast(
		full_parse_timer: LintStageTimerContract,
		stage_prefix = "",
	): ReadonlyMap<string, NormalizedAstFile> {
		let resolved_stage_prefix = PYTHON_AST_STAGE_PREFIX;
		if (stage_prefix.length > 0) {
			resolved_stage_prefix = stage_prefix;
		}
		const files = this._files.filter((file) => this.supports(file));
		const texts = this.source_texts(files);
		const asts = this.parsed_asts(files, texts, full_parse_timer, resolved_stage_prefix);
		return this.ast_records(files, asts);
	}
}
