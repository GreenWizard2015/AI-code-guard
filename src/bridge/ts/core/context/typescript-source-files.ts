import { extname } from 'node:path';
import ts from 'typescript';

/** Responsibilities: _TypeScript source caching_. **/
export class TypeScriptSourceFiles {
	private readonly files: readonly string[];
	private readonly texts: ReadonlyMap<string, string>;
	private readonly typescript_extensions = new Set(['.ts', '.tsx']);

	/** Responsibilities: _selection TypeScript parser script_. **/
	private script_kind(file: string): ts.ScriptKind {
		if (file.endsWith('.tsx')) {
			return ts.ScriptKind.TSX;
		}
		return ts.ScriptKind.TS;
	}

	/** Responsibilities: _source file access_. **/
	private source_file(file: string): ts.SourceFile {
		let source_text = this.texts.get(file);
		if (source_text === undefined) {
			source_text = '';
		}
		return ts.createSourceFile(
			file,
			source_text,
			ts.ScriptTarget.Latest,
			true,
			this.script_kind(file),
		);
	}

	/** Responsibilities: _initialization source paths texts_. **/
	public constructor(files: readonly string[], texts: ReadonlyMap<string, string>) {
		this.files = files;
		this.texts = texts;
	}

	/** Responsibilities: _reporting path supported TypeScript_. **/
	public supports(file: string): boolean {
		return this.typescript_extensions.has(extname(file));
	}

	/** Responsibilities: _supported TypeScript output_. **/
	public source_files(): Map<string, ts.SourceFile> {
		const source_files = new Map<string, ts.SourceFile>();
		for (const file of this.files) {
			if (this.supports(file)) {
				source_files.set(file, this.source_file(file));
			}
		}
		return source_files;
	}
}
