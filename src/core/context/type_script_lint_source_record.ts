import type { LintFileNameContract, TypeScriptLintSourceRecordOptions } from "src/source_types";
import type { NormalizedAstFileContract } from "src/types";
import type { LintSourceRecordContract } from "src/source_protocols";
import type { SourceFileResolver } from "src/source_types";
import type { TypeScriptAstFileContract, TypeScriptAstTraversalContract } from "src/typescript_runtime_protocols";
import { TYPESCRIPT_LANGUAGE } from "src/constants";

/** Responsibilities: _storage normalization TypeScript lint_, _AST access exposure_. **/
export class TypeScriptLintSourceRecord implements LintSourceRecordContract {
	public readonly absolute_path: string;
	public readonly relative_path: string;
	public readonly file_name: LintFileNameContract;
	public readonly text: string;
	public readonly normalized_ast: NormalizedAstFileContract;
	public readonly language = TYPESCRIPT_LANGUAGE;
	public readonly typescript_ast: TypeScriptAstFileContract;
	public readonly source_resolver: SourceFileResolver;
	public readonly traversal: TypeScriptAstTraversalContract;

	/** Responsibilities: _initialization normalization TypeScript lint_. **/
	public constructor(
		options: TypeScriptLintSourceRecordOptions,
		typescript_ast: TypeScriptAstFileContract,
		traversal: TypeScriptAstTraversalContract,
	) {
		this.absolute_path = options.absolute_path;
		this.relative_path = options.relative_path;
		this.file_name = options.file_name;
		this.text = options.text;
		this.normalized_ast = options.normalized_ast;
		this.typescript_ast = typescript_ast;
		this.source_resolver = options.source_resolver;
		this.traversal = traversal;
	}

	/** Responsibilities: _reporting this record TypeScript_. **/
	public typescript(): boolean {
		return this.absolute_path.length > 0 && this.relative_path.length > 0;
	}

	/** Responsibilities: _reporting this record not_. **/
	public python(): boolean {
		return false;
	}
}
