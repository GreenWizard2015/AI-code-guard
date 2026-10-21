import type { PythonAstDataContract, PythonSourceFilesContract } from "src/python_protocols";
import type { LintStageTimerContract } from "src/shared_services_protocols";
import type { NormalizedAstFileContract, PythonSourceAstBatch } from "src/types";
import { PYTHON_AST_STAGE_PREFIX } from "src/core/constants";

/** Responsibilities: _Python sources selection_, _batch-parse Python AST files_. **/
export class PythonSourceFiles implements PythonSourceFilesContract {
	private readonly files: readonly string[];
	private readonly texts: ReadonlyMap<string, string>;
	private readonly python_ast_parser: PythonAstDataContract;
	private readonly repo_root: string;

	/** Responsibilities: _Python source text collection_. **/
	private source_texts(files: readonly string[]): string[] {
		return files.map((file) => {
			const text = this.texts.get(file);
			if (text === undefined) {
				return "";
			}
			return text;
		});
	}

	/** Responsibilities: _Python AST batch parsing_. **/
	private parsed_asts(
		files: readonly string[],
		texts: readonly string[],
		stage_timer: LintStageTimerContract,
		stage_prefix: string,
	): NormalizedAstFileContract[] {
		return this.python_ast_parser.batch_ast({
			texts,
			stage_timer,
			stage_prefix,
			files,
			repo_root: this.repo_root,
		});
	}

	/** Responsibilities: _Python AST file mapping_. **/
	private ast_records(
		files: readonly string[],
		asts: readonly NormalizedAstFileContract[],
	): ReadonlyMap<string, NormalizedAstFileContract> {
		const result = new Map<string, NormalizedAstFileContract>();
		for (const [index, file] of files.entries()) {
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
		this.files = files;
		this.texts = texts;
		this.python_ast_parser = parser;
		this.repo_root = repo_root;
	}

	/** Responsibilities: _Python source files identification_. **/
	public supports(file: string): boolean {
		return file.toLowerCase().endsWith(".py");
	}

	/** Responsibilities: _Python source batch beginning_. **/
	public begin_source_ast(stage_timer: LintStageTimerContract, stage_prefix = ""): PythonSourceAstBatch {
		const begin_batch = this.python_ast_parser.begin_batch_ast;
		if (begin_batch === undefined) {
			return { files: [], batch_id: "" };
		}
		let resolved_stage_prefix = PYTHON_AST_STAGE_PREFIX;
		if (stage_prefix.length > 0) {
			resolved_stage_prefix = stage_prefix;
		}
		const files = this.files.filter((file) => this.supports(file));
		const batch_id = begin_batch.call(this.python_ast_parser, {
			texts: this.source_texts(files),
			stage_timer,
			stage_prefix: resolved_stage_prefix,
			files,
			repo_root: this.repo_root,
		});
		return { files, batch_id };
	}

	/** Responsibilities: _Python source batch completion_. **/
	public complete_source_ast(batch: PythonSourceAstBatch): ReadonlyMap<string, NormalizedAstFileContract> {
		const complete_batch = this.python_ast_parser.complete_batch_ast;
		if (complete_batch === undefined) {
			throw new Error("Python AST split batch completion is unavailable.");
		}
		return this.ast_records(
			batch.files,
			complete_batch.call(this.python_ast_parser, batch.batch_id),
		);
	}

	/** Responsibilities: _batch-parse supported Python sources_. **/
	public source_ast(
		stage_timer: LintStageTimerContract,
		stage_prefix = "",
	): ReadonlyMap<string, NormalizedAstFileContract> {
		let resolved_stage_prefix = PYTHON_AST_STAGE_PREFIX;
		if (stage_prefix.length > 0) {
			resolved_stage_prefix = stage_prefix;
		}
		const files = this.files.filter((file) => this.supports(file));
		const texts = this.source_texts(files);
		const asts = this.parsed_asts(files, texts, stage_timer, resolved_stage_prefix);
		return this.ast_records(files, asts);
	}
}
