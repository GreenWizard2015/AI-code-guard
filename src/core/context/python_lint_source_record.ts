import type { LintSourceRecord, LintFileNameContract, LintSourceRecordOptions } from "src/source_types";
import type { NormalizedAstFile } from "src/types";
import type { SourceFileResolver } from "src/source_types";
import type { TypeScriptAstFileContract, TypeScriptAstTraversalContract } from "src/typescript_runtime_protocols";
import ts from "typescript";
import { TypeScriptAstTraversal } from "src/parser/analysis/type_script_ast_traversal";

/** Responsibilities: _storage normalization Python lint_, _language-specific accessors exposure_. **/
export class PythonLintSourceRecord implements LintSourceRecord {
	public readonly absolute_path: string;
	public readonly relative_path: string;
	public readonly file_name: LintFileNameContract;
	public readonly text: string;
	public readonly normalized_ast: NormalizedAstFile;
	public readonly language = "python" as const;
	public readonly source_resolver: SourceFileResolver;
	public readonly traversal: TypeScriptAstTraversalContract;

	/** Responsibilities: _initialization normalization Python lint_. **/
	public constructor(options: LintSourceRecordOptions) {
		this.absolute_path = options.absolute_path;
		this.relative_path = options.relative_path;
		this.file_name = options.file_name;
		this.text = options.text;
		this.normalized_ast = options.normalized_ast;
		this.source_resolver = new Map();
		const source_file = ts.createSourceFile(options.absolute_path, "", ts.ScriptTarget.Latest, true, ts.ScriptKind.TS);
		const traversal = new TypeScriptAstTraversal(source_file);
		traversal.collect();
		this.traversal = traversal;
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
	public get typescript_ast(): TypeScriptAstFileContract {
		throw new Error("TypeScript AST is unavailable for Python source.");
	}
}
