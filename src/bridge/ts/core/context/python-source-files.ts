import type { PythonAstDataProtocol, LintStageTimerProtocol } from "src/protocols";
import type { NormalizedAstFile } from "src/types";

/** Responsibilities: _Python sources selection_, _batch-parse Python AST files_. **/
export class PythonSourceFiles {
	private readonly files: readonly string[];
	private readonly texts: ReadonlyMap<string, string>;
	private readonly python_ast_parser: PythonAstDataProtocol;
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
		stage_timer: LintStageTimerProtocol,
		stage_prefix: string,
	): NormalizedAstFile[] {
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
		asts: readonly NormalizedAstFile[],
	): ReadonlyMap<string, NormalizedAstFile> {
		const result = new Map<string, NormalizedAstFile>();
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
		parser: PythonAstDataProtocol,
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

	/** Responsibilities: _batch-parse supported Python sources_. **/
	public source_ast(
		stage_timer: LintStageTimerProtocol,
		stage_prefix = "python-bridge",
	): ReadonlyMap<string, NormalizedAstFile> {
		const files = this.files.filter((file) => this.supports(file));
		const texts = this.source_texts(files);
		const asts = this.parsed_asts(files, texts, stage_timer, stage_prefix);
		return this.ast_records(files, asts);
	}
}
