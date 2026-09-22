import type {
	LintSourceRecord,
	LintFileNameContract,
	LintSourceRecordOptions,
	NormalizedAstFile,
} from 'src/types';
import type { TypeScriptAstFile } from 'src/model/typescript-ast';

/** Responsibilities: _storage normalization TypeScript lint_, _AST access exposure_. **/
export class TypeScriptLintSourceRecord implements LintSourceRecord {
	public readonly absolute_path: string;
	public readonly relative_path: string;
	public readonly file_name: LintFileNameContract;
	public readonly text: string;
	public readonly normalized_ast: NormalizedAstFile;
	public readonly language = 'typescript' as const;
	public readonly typescript_ast: TypeScriptAstFile;

	/** Responsibilities: _initialization normalization TypeScript lint_. **/
	public constructor(options: LintSourceRecordOptions, typescript_ast: TypeScriptAstFile) {
		this.absolute_path = options.absolute_path;
		this.relative_path = options.relative_path;
		this.file_name = options.file_name;
		this.text = options.text;
		this.normalized_ast = options.normalized_ast;
		this.typescript_ast = typescript_ast;
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
