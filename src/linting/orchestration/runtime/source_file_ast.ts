import { CodingRuleSource } from "src/linting/orchestration/runtime/coding_rule_source";
import type ts from "typescript";
import type {
	NormalizedAstFileContract,
	ParseLanguage,
} from "src/types";
import type { CodingRuleSourceOptions, CodingRuleSourceData } from "src/source_types";
import type { SourceFileAstContract } from "src/source_protocols";
import type { SourceFileResolver } from "src/source_types";
import type { TypeScriptAstTraversalContract } from "src/typescript_runtime_protocols";
import { PYTHON_LANGUAGE, TYPESCRIPT_LANGUAGE } from "src/constants";

/** Responsibilities: _source data storage parsing_, _source language exposure_. **/
export class SourceFileAst implements SourceFileAstContract {
	private readonly source: CodingRuleSourceData;

	/** Responsibilities: _initialization coding-rule source parsing_. **/
	public constructor(
		source: CodingRuleSourceOptions,
		normalized_ast: NormalizedAstFileContract,
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
		this.source = coding_source.snapshot();
	}

	/** Responsibilities: _source language classification_. **/
	public language(): ParseLanguage {
		if (this.source.file.endsWith(".py")) {
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
			file: this.source.file,
			text: this.source.text,
			normalized_ast: this.source.normalized_ast,
			source_file: this.source.source_file,
			source_resolver: this.source.source_resolver,
			traversal: this.source.traversal,
		};
	}
}
