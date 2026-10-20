import type { AstCallableNodeContract, AstCodingIssue, AstPythonImport, ImportedFunction, NormalizedAstFile, PythonBatchAstOptions, PythonSourceAstBatch } from "src/types";
import type { ArchitectureInput } from "src/model/types/types";
import type { ViolationContract } from "src/reporting_protocols";
import type { LintStageTimerContract } from "src/shared_services_protocols";
import type { AstCacheEntryContract } from "src/source_protocols";
import type { PythonAstBatchParser } from "src/python_types";
import type { CodingRuleSourceData } from "src/source_types";

/** Responsibilities: _Python import file index_. **/
export interface PythonImportFileIndexContract {
	directories(files: ReadonlySet<string>): Map<string, string[]>;
	root_files(root: string, files: ReadonlySet<string>): readonly string[];
	importable_parts(root: string, files: ReadonlySet<string>): Set<string>;
	import_roots(root: string, files: ReadonlySet<string>): readonly string[];
}

/** Responsibilities: _Python class singleton collection_. **/
export interface PythonClassVariableSingletonsContract {
	violations(): ViolationContract[];
}

/** Responsibilities: _Python architecture violation collection_. **/
export interface PythonArchitectureContract {
	append_architecture_violations(input: ArchitectureInput): void;
}

/** Responsibilities: _Python assignment violation collection_. **/
export interface PythonHacksContract {
	append_assignment_violations(
		violations: ViolationContract[],
		file: string,
		callables: AstCallableNodeContract[],
	): void;
}

/** Responsibilities: _Python type rule collection_. **/
export interface PythonTypeRuleCollectorContract {
	append_type_rules(): void;
	append_type_information(): void;
}

/** Responsibilities: _Python import source resolution_. **/
export interface PythonImportResolutionContract {
	collect_project_imports(
		file: string,
		python_imports: AstPythonImport[],
		root: string,
		files: ReadonlySet<string>,
	): Map<string, ImportedFunction>;
}

/** Responsibilities: _Python AST batch parsing_. **/
export interface PythonAstDataContract {
	batch_ast(options: PythonBatchAstOptions): NormalizedAstFile[];
	source_ast(text: string): NormalizedAstFile;
	begin_batch_ast?(options: PythonBatchAstOptions): string;
	complete_batch_ast?(batch_id: string): NormalizedAstFile[];
}

/** Responsibilities: _Python source batch lifecycle_. **/
export interface PythonSourceFilesContract {
	begin_source_ast(stage_timer: LintStageTimerContract, stage_prefix: string): PythonSourceAstBatch;
	complete_source_ast(batch: PythonSourceAstBatch): ReadonlyMap<string, NormalizedAstFile>;
	source_ast(stage_timer: LintStageTimerContract, stage_prefix: string): ReadonlyMap<string, NormalizedAstFile>;
}

/** Responsibilities: _Python test rule collection_. **/
export interface PythonTestRuleCollectorContract {
	append_shape(): void;
	append_assertions(): void;
}

/** Responsibilities: _Python AST batch caching_. **/
export interface PythonAstBatchCacheContract {
	cached(text: string): AstCacheEntryContract;
	resolve(options: PythonBatchAstOptions, parse: PythonAstBatchParser): NormalizedAstFile[];
}

/** Responsibilities: _Python coding rule collection_. **/
export interface PythonCodingRuleCollectorContract {
	collect_python_rules(source: CodingRuleSourceData): ViolationContract[];
	append_ast_issues(violations: ViolationContract[], source: CodingRuleSourceData, issues: AstCodingIssue[]): void;
}
