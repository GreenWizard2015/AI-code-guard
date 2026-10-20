import { relative } from "node:path";
import { extname } from "node:path";
import { AstDiskCache } from "src/core/cache/ast_disk_cache";
import { ContextSourceRecordCache } from "src/core/context/context_source_record_cache";
import { ContextSourceRecordCacheIdentity } from "src/core/context/context_source_record_cache_identity";
import { LintFileName } from "src/core/context/lint_file_name";
import { PythonLintSourceRecord } from "src/core/context/python_lint_source_record";
import { TypeScriptLintSourceRecord } from "src/core/context/type_script_lint_source_record";
import { TypeScriptAstFile } from "src/model/ast/type_script_ast_file";
import type { TypeScriptAstOptions } from "src/model/types";
import type { ContextSourceRecordCacheContract } from "src/cache_protocols";
import type { ProjectAnalysisIdentityContract } from "src/runtime_protocols";
import type { TypeScriptAstFileContract } from "src/typescript_runtime_protocols";
import type { LintFileNameContract } from "src/source_types";
import type {
	ContextSourceRecordOptions,
	ContextSourceRecordsOptions,
	LintSourceRecord,
	TypeScriptAstCreation,
	TypeScriptAstCreationOptions,
} from "src/source_types";
import type { LintRunStatistics, NormalizedAstFile } from "src/types";
import ts from "typescript";
import type { IOContract } from "src/io/protocols";

/** Responsibilities: _source language classification_, _source record construction_. **/
export class ContextSourceRecordSet {
	private readonly analysis_identity: ProjectAnalysisIdentityContract;
	private readonly file_io: IOContract;
	private readonly typescript_extensions = [".ts", ".tsx"];
	private readonly disk_cache_enabled = process.env.NODE_ENV !== "test";

	/** Responsibilities: _TypeScript source paths classification_. **/
	private typescript(file: string): boolean {
		const extension = extname(file);
		if (extension.length === 0) {
			return false;
		}
		return this.typescript_extensions.includes(extension);
	}

	/** Responsibilities: _retrieval source text file_. **/
	private source_text(texts: ReadonlyMap<string, string>, file: string): string {
		const text = texts.get(file);
		if (text === undefined) {
			return "";
		}
		return text;
	}

	/** Responsibilities: _selection TypeScript parser mode_. **/
	private script_kind(file: string): ts.ScriptKind {
		if (file.endsWith(".tsx")) {
			return ts.ScriptKind.TSX;
		}
		return ts.ScriptKind.TS;
	}

	/** Responsibilities: _creation reuse TypeScript AST_. **/
	private create_typescript_ast(options: TypeScriptAstCreationOptions): TypeScriptAstCreation {
		let source_file = options.source_files.get(options.file);
		if (source_file === undefined) {
			source_file = ts.createSourceFile(
				options.file,
				options.text,
				ts.ScriptTarget.Latest,
				true,
				this.script_kind(options.file),
			);
		}
		const ast_options: TypeScriptAstOptions = {
			source_file,
			source_resolver: options.source_files,
			source_io: options.source_io,
			project_root: options.project_root,
			stage_timer: options.stage_timer,
		};
		const ast_file = new TypeScriptAstFile(options.file, options.text, ast_options);
		return { ast_file, traversal: ast_file.traversal };
	}

	/** Responsibilities: _retrieval normalization Python AST_. **/
	private python_ast_for(python_file_asts: ReadonlyMap<string, NormalizedAstFile>, file: string): NormalizedAstFile {
		const ast = python_file_asts.get(file);
		if (ast === undefined) {
			throw new Error(`Python AST is missing for ${file}.`);
		}
		return ast;
	}

	/** Responsibilities: _validation retrieval Python AST_. **/
	private python_ast_argument(
		file: string,
		python_file_asts: ReadonlyMap<string, NormalizedAstFile>,
	): NormalizedAstFile {
		if (this.typescript(file)) {
			throw new Error(`Python AST was requested for TypeScript file ${file}.`);
		}
		return this.python_ast_for(python_file_asts, file);
	}

	/** Responsibilities: _construction Python lint source_. **/
	private python_source_record(
		file: string,
		relative_path: string,
		file_name: LintFileNameContract,
		text: string,
		python_ast: NormalizedAstFile,
	): LintSourceRecord {
		return new PythonLintSourceRecord({
			absolute_path: file,
			relative_path,
			file_name,
			text,
			normalized_ast: python_ast,
		});
	}

	/** Responsibilities: _construction TypeScript lint source_. **/
	private typescript_record(
		options: ContextSourceRecordOptions,
		relative_path: string,
		file_name: LintFileNameContract,
	): LintSourceRecord {
		const typescript_creation = this.create_typescript_ast({
			file: options.file,
			text: options.text,
			source_files: options.source_files,
			project_root: options.repo_root,
			stage_timer: options.stage_timer,
			source_io: options.source_io,
		});
		const normalized_ast = this.normalized_ast(options, typescript_creation.ast_file);
		return new TypeScriptLintSourceRecord(
			{
				absolute_path: options.file,
				relative_path,
				file_name,
				text: options.text,
				normalized_ast,
				source_resolver: options.source_files,
			},
			typescript_creation.ast_file,
			typescript_creation.traversal,
		);
	}

	/** Responsibilities: _TypeScript AST normalization_. **/
	private normalized_ast(
		options: ContextSourceRecordOptions,
		typescript_ast: TypeScriptAstFileContract,
	): NormalizedAstFile {
		const cached = options.typescript_asts.get(options.file);
		if (cached === undefined) {
			return typescript_ast.normalized();
		}
		return typescript_ast.reference_normalization(cached);
	}

	/** Responsibilities: _normalization source path construction_. **/
	private source_record(options: ContextSourceRecordOptions): LintSourceRecord {
		const relative_path = relative(options.repo_root, options.file).split("\\").join("/");
		const file_name = new LintFileName(relative_path);
		if (this.typescript(options.file)) {
			return this.typescript_record(options, relative_path, file_name);
		}
		return this.python_source_record(
			options.file,
			relative_path,
			file_name,
			options.text,
			this.python_ast_argument(options.file, options.python_file_asts),
		);
	}

	/** Responsibilities: _source record cache_. **/
	private source_record_cache(options: ContextSourceRecordsOptions): ContextSourceRecordCacheContract {
		const has_typescript_files = options.files.some((file) => this.typescript(file));
		let cache_enabled = this.disk_cache_enabled;
		if (!has_typescript_files || options.virtual_project) {
			cache_enabled = false;
		}
		const cache_identity = new ContextSourceRecordCacheIdentity(
			options.repo_root,
			options.project_files,
			options.texts,
			options.source_io,
		);
		const disk_cache = new AstDiskCache(
			options.repo_root,
			cache_identity.cache_identity(),
			this.analysis_identity,
			"",
			this.file_io,
		);
		return new ContextSourceRecordCache(disk_cache, cache_enabled);
	}

	/** Responsibilities: _source record normalization_. **/
	private normalized_records(
		options: ContextSourceRecordsOptions,
		typescript_asts: ReadonlyMap<string, NormalizedAstFile>,
	): LintSourceRecord[] {
		return options.files.map((file) =>
			this.source_record({
				repo_root: options.repo_root,
				file,
				text: this.source_text(options.texts, file),
				source_files: options.source_files,
				python_file_asts: options.python_file_asts,
				typescript_asts,
				stage_timer: options.stage_timer,
				source_io: options.source_io,
			}),
		);
	}

	/** Responsibilities: _project cache identity ownership_. **/
	public constructor(analysis_identity: ProjectAnalysisIdentityContract, file_io: IOContract) {
		this.analysis_identity = analysis_identity;
		this.file_io = file_io;
	}

	/** Responsibilities: _construction source records requested_. **/
	public source_records(options: ContextSourceRecordsOptions): LintSourceRecord[] {
		const cache = options.stage_timer.measure("startup.project-context.source-records.cache-initialize", () =>
			this.source_record_cache(options),
		);
		options.stage_timer.measure("startup.project-context.source-records.cache-clean", () => cache.clean());
		const typescript_asts = cache.cached_asts(options.files, options.texts, options.stage_timer);
		const records = options.stage_timer.measure("startup.project-context.source-records.record-construction", () =>
			this.normalized_records(options, typescript_asts),
		);
		return cache.write(options.files, options.texts, records, typescript_asts, options.stage_timer);
	}

	/** Responsibilities: _summary source reading parser_. **/
	public statistics(files: readonly string[], source_files: ReadonlyMap<string, ts.SourceFile>): LintRunStatistics {
		return {
			source_reads: files.length,
			typescript_parses: source_files.size,
			python_parses: files.filter((file) => file.endsWith(".py")).length,
			source_records: files.length,
		};
	}
}
