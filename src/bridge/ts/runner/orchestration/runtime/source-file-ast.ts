import { CodingRuleSource } from "src/bridge/ts/runner/orchestration/runtime/coding-rule-source";
import type ts from "typescript";
import type {
	CodingRuleSourceOptions,
	NormalizedAstFile,
	ParseLanguage,
	PreparedCodingRuleSourceOptions,
} from "src/types";
import type { CodingRuleSourceData } from "src/protocols";

/** Responsibilities: _source data storage parsing_, _source language exposure_. **/
export class SourceFileAst {
	public readonly source: CodingRuleSource;

	/** Responsibilities: _initialization coding-rule source parsing_. **/
	public constructor(source: CodingRuleSourceOptions, normalized_ast: NormalizedAstFile, source_file: ts.SourceFile) {
		const prepared: PreparedCodingRuleSourceOptions = {
			file: source.file,
			text: source.text,
			normalized_ast,
			source_file,
		};
		this.source = new CodingRuleSource(source, prepared);
	}

	/** Responsibilities: _source language classification_. **/
	public language(): ParseLanguage {
		if (this.source.file.endsWith(".py")) {
			return "python";
		}
		return "typescript";
	}

	/** Responsibilities: _reporting source Python_. **/
	public python(): boolean {
		return this.language() === "python";
	}

	/** Responsibilities: _reporting source TypeScript_. **/
	public typescript(): boolean {
		return this.language() === "typescript";
	}

	/** Responsibilities: _coding source access_. **/
	public snapshot(): CodingRuleSourceData {
		return {
			file: this.source.file,
			text: this.source.text,
			normalized_ast: this.source.normalized_ast,
			source_file: this.source.source_file,
		};
	}
}
