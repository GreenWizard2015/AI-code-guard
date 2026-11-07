import { PYTHON_LANGUAGE, TYPESCRIPT_LANGUAGE } from "src/constants";
import { CodingRuleSource } from "src/linting/orchestration/runtime/coding_rule_source";
import type { NormalizedAstFile } from "src/model/ast/normalized_ast_types";
import type { SourceFileAstContract } from "src/source_protocols";
import type { CodingRuleSourceData, CodingRuleSourceOptions } from "src/source_types";
import type { SourceFileResolver } from "src/source_types";
import type { ParseLanguage } from "src/types";
import type { TypeScriptAstTraversalContract } from "src/typescript_runtime_protocols";
import type ts from "typescript";

/** Responsibilities: _source data storage parsing_, _source language exposure_. **/
export class SourceFileAst implements SourceFileAstContract {
	private readonly _source: CodingRuleSourceData;

	/** Responsibilities: _initialization coding-rule source parsing_. **/
	public constructor(
		source: CodingRuleSourceOptions,
		normalized_ast: NormalizedAstFile,
		source_file: ts.SourceFile,
		source_resolver: SourceFileResolver,
		traversal: TypeScriptAstTraversalContract,
	) {
		const prepared: CodingRuleSourceData = {
			file: source.file,
			text: source.text,
			normalized_ast,
			source_file,
			source_resolver,
			traversal,
		};
		const coding_source = new CodingRuleSource(source, prepared);
		this._source = coding_source.snapshot();
	}

	/** Responsibilities: _source language classification_. **/
	public language(): ParseLanguage {
		if (this._source.file.endsWith(".py")) {
			return PYTHON_LANGUAGE;
		}
		return TYPESCRIPT_LANGUAGE;
	}

	/** Responsibilities: _reporting source Python_. **/
	public python(): boolean {
		return this.language() === PYTHON_LANGUAGE;
	}

	/** Responsibilities: _reporting source TypeScript_. **/
	public typescript(): boolean {
		return this.language() === TYPESCRIPT_LANGUAGE;
	}

	/** Responsibilities: _coding source access_. **/
	public snapshot(): CodingRuleSourceData {
		return {
			file: this._source.file,
			text: this._source.text,
			normalized_ast: this._source.normalized_ast,
			source_file: this._source.source_file,
			source_resolver: this._source.source_resolver,
			traversal: this._source.traversal,
		};
	}
}
