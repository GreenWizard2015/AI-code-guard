import type {
	LintSourceRecord,
	LintFileNameContract,
	LintSourceRecordOptions,
	NormalizedAstFile,
} from 'src/types';
import type { TypeScriptAstFile } from 'src/model/typescript-ast';

/** Responsibilities: _storage normalization Python lint_, _language-specific accessors exposure_. **/
export class PythonLintSourceRecord implements LintSourceRecord {
	public readonly absolute_path: string;
	public readonly relative_path: string;
	public readonly file_name: LintFileNameContract;
	public readonly text: string;
	public readonly normalized_ast: NormalizedAstFile;
	public readonly language = 'python' as const;

	/** Responsibilities: _initialization normalization Python lint_. **/
	public constructor(options: LintSourceRecordOptions) {
		this.absolute_path = options.absolute_path;
		this.relative_path = options.relative_path;
		this.file_name = options.file_name;
		this.text = options.text;
		this.normalized_ast = options.normalized_ast;
	}

	/** Responsibilities: _reporting this record not_. **/
	public typescript(): boolean {
		return false;
	}

	/** Responsibilities: _reporting this record Python_. **/
	public python(): boolean {
		return this.absolute_path.length > 0 && this.relative_path.length > 0;
	}

	/** Responsibilities: _unavailable TypeScript AST rejection_. **/
	public get typescript_ast(): TypeScriptAstFile {
		throw new Error('TypeScript AST is unavailable for Python source.');
	}
}
