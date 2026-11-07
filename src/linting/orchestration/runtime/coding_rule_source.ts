import type ts from "typescript";

import { PYTHON_LANGUAGE, TYPESCRIPT_LANGUAGE } from "src/constants";
import type { NormalizedAstFile } from "src/model/ast/normalized_ast_types";
import type { CodingRuleSourceContract } from "src/shared_services_protocols";
import type { CodingRuleSourceData, CodingRuleSourceOptions } from "src/source_types";
import type { SourceFileResolver } from "src/source_types";
import type { ParseLanguage } from "src/types";
import type { TypeScriptAstTraversalContract } from "src/typescript_runtime_protocols";

/** Responsibilities: _coding-rule source data storage_, _source language exposure parsing_. **/
export class CodingRuleSource implements CodingRuleSourceContract {
	private readonly _file: string;
	private readonly _text: string;
	private readonly _normalized_ast: NormalizedAstFile;
	private readonly _source_file: ts.SourceFile;
	private readonly _source_resolver: SourceFileResolver;
	private readonly _traversal: TypeScriptAstTraversalContract;

	/** Responsibilities: _source text initialization_, _initialization normalization TypeScript ASTs_. **/
	public constructor(options: CodingRuleSourceOptions, prepared: CodingRuleSourceData) {
		this._file = options.file;
		this._text = options.text;
		this._normalized_ast = prepared.normalized_ast;
		this._source_file = prepared.source_file;
		this._source_resolver = prepared.source_resolver;
		this._traversal = prepared.traversal;
	}

	/** Responsibilities: _source lint data projection_. **/
	public snapshot(): CodingRuleSourceData {
		return {
			file: this._file,
			text: this._text,
			normalized_ast: this._normalized_ast,
			source_file: this._source_file,
			source_resolver: this._source_resolver,
			traversal: this._traversal,
		};
	}

	/** Responsibilities: _source language classification_. **/
	public language(): ParseLanguage {
		if (this._file.endsWith(".py")) {
			return PYTHON_LANGUAGE;
		}
		return TYPESCRIPT_LANGUAGE;
	}
}
