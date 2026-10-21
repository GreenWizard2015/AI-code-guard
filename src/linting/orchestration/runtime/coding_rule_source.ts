import ts from "typescript";

import type {
	NormalizedAstFileContract,
	ParseLanguage,
} from "src/types";
import type { CodingRuleSourceOptions, CodingRuleSourceData } from "src/source_types";
import type { CodingRuleSourceContract } from "src/shared_services_protocols";
import type { SourceFileResolver } from "src/source_types";
import type { TypeScriptAstTraversalContract } from "src/typescript_runtime_protocols";
import { PYTHON_LANGUAGE, TYPESCRIPT_LANGUAGE } from "src/constants";

/** Responsibilities: _coding-rule source data storage_, _source language exposure parsing_. **/
export class CodingRuleSource implements CodingRuleSourceContract {
	public readonly file: string;
	public readonly text: string;
	public readonly normalized_ast: NormalizedAstFileContract;
	public readonly source_file: ts.SourceFile;
	public readonly source_resolver: SourceFileResolver;
	public readonly traversal: TypeScriptAstTraversalContract;

	/** Responsibilities: _source text initialization_, _initialization normalization TypeScript ASTs_. **/
	public constructor(options: CodingRuleSourceOptions, prepared: CodingRuleSourceData) {
		this.file = options.file;
		this.text = options.text;
		this.normalized_ast = prepared.normalized_ast;
		this.source_file = prepared.source_file;
		this.source_resolver = prepared.source_resolver;
		this.traversal = prepared.traversal;
	}

	/** Responsibilities: _exposure normalization Python AST_. **/
	public get normalized_python_ast(): NormalizedAstFileContract {
		return this.normalized_ast;
	}

	/** Responsibilities: _source lint data projection_. **/
	public snapshot(): CodingRuleSourceData {
		return {
			file: this.file,
			text: this.text,
			normalized_ast: this.normalized_ast,
			source_file: this.source_file,
			source_resolver: this.source_resolver,
			traversal: this.traversal,
		};
	}

	/** Responsibilities: _source language classification_. **/
	public language(): ParseLanguage {
		if (this.file.endsWith(".py")) {
			return PYTHON_LANGUAGE;
		}
		return TYPESCRIPT_LANGUAGE;
	}
}
