import { extname } from "node:path";
import ts from "typescript";

/** Responsibilities: _TypeScript source selection_, _parsed source file reuse_. **/
export class TypeScriptSourceFiles {
	private readonly _files: readonly string[];
	private readonly _texts: ReadonlyMap<string, string>;
	private readonly _typescript_extensions: Set<string>;

	/** Responsibilities: _selection TypeScript parser script_. **/
	private script_kind(source_path: string): ts.ScriptKind {
		if (source_path.endsWith(".tsx")) {
			return ts.ScriptKind.TSX;
		}
		return ts.ScriptKind.TS;
	}

	/** Responsibilities: _source file access_. **/
	private source_file(source_path: string): ts.SourceFile {
		let source_text = this._texts.get(source_path);
		if (source_text === undefined) {
			source_text = "";
		}
		return ts.createSourceFile(source_path, source_text, ts.ScriptTarget.Latest, true, this.script_kind(source_path));
	}

	/** Responsibilities: _initialization source paths texts_. **/
	public constructor(files: readonly string[], texts: ReadonlyMap<string, string>) {
		this._typescript_extensions = new Set([".ts", ".tsx", ".mts", ".cts"]);
		this._files = files;
		this._texts = texts;
	}

	/** Responsibilities: _reporting path supported TypeScript_. **/
	public supports(candidate_path: string): boolean {
		return this._typescript_extensions.has(extname(candidate_path));
	}

	/** Responsibilities: _supported TypeScript output_. **/
	public source_files(): Map<string, ts.SourceFile> {
		const source_files = new Map<string, ts.SourceFile>();
		for (const candidate_path of this._files) {
			if (this.supports(candidate_path)) {
				source_files.set(candidate_path, this.source_file(candidate_path));
			}
		}
		return source_files;
	}
}
