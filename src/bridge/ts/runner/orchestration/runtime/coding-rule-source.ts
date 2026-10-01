import ts from "typescript";

import type {
	CodingRuleSourceOptions,
	NormalizedAstFile,
	ParseLanguage,
	PreparedCodingRuleSourceOptions,
} from "src/types";
import type { CodingRuleSourceData } from "src/protocols";

/** Responsibilities: _coding-rule source data storage_, _source language exposure parsing_. **/
export class CodingRuleSource {
	public readonly file: string;
	public readonly text: string;
	public readonly normalized_ast: NormalizedAstFile;
	public readonly source_file: ts.SourceFile;

	/** Responsibilities: _source text initialization_, _initialization normalization TypeScript ASTs_. **/
	public constructor(options: CodingRuleSourceOptions, prepared: PreparedCodingRuleSourceOptions) {
		this.file = options.file;
		this.text = options.text;
		this.normalized_ast = prepared.normalized_ast;
		this.source_file = prepared.source_file;
	}

	/** Responsibilities: _exposure normalization Python AST_. **/
	public get normalized_python_ast(): NormalizedAstFile {
		return this.normalized_ast;
	}

	/** Responsibilities: _source lint data projection_. **/
	public snapshot(): CodingRuleSourceData {
		return {
			file: this.file,
			text: this.text,
			normalized_ast: this.normalized_ast,
			source_file: this.source_file,
		};
	}

	/** Responsibilities: _source language classification_. **/
	public language(): ParseLanguage {
		if (this.file.endsWith(".py")) {
			return "python";
		}
		return "typescript";
	}
}
