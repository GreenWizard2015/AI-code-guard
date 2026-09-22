import { PythonAstData } from 'src/bridge/ts/core/python-ast-parser';
import type { NormalizedAstFile } from 'src/types';

/** Responsibilities: _Python sources selection_, _batch-parse Python AST files_. **/
export class PythonSourceFiles {
	private readonly files: readonly string[];
	private readonly texts: ReadonlyMap<string, string>;
	private readonly python_ast_parser: PythonAstData;

	/** Responsibilities: _initialization Python source paths_, _parser initialization_. **/
	public constructor(
		files: readonly string[],
		texts: ReadonlyMap<string, string>,
		...parsers: PythonAstData[]
	) {
		this.files = files;
		this.texts = texts;
		if (parsers.length === 0) {
			this.python_ast_parser = new PythonAstData();
		} else {
			this.python_ast_parser = parsers[0];
		}
	}

	/** Responsibilities: _Python source files identification_. **/
	public supports(file: string): boolean {
		return file.endsWith('.py');
	}

	/** Responsibilities: _batch-parse supported Python sources_. **/
	public source_ast(): ReadonlyMap<string, NormalizedAstFile> {
		const files = this.files.filter(file => this.supports(file));
		const texts = files.map(file => {
			let text = this.texts.get(file);
			if (text === undefined) {
				text = '';
			}
			return text;
		});
		const asts = this.python_ast_parser.batch_ast(texts);
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
}
