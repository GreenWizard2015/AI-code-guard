import type { SpawnOptions } from "node:child_process";
import type { PythonAstWorkerResponse } from "src/core/python-ast/types";
import type {
	AstCallableNode,
	AstPythonImport,
	ImportedFunction,
	NormalizedAstFile,
	PythonBatchAstOptions,
	PythonSourceAstBatch,
} from "src/model/ast/normalized_ast_types";
import type { ArchitectureInput } from "src/model_types";
import type { CallablePythonAstBatchParser, PythonImportRootIndexContract } from "src/python_types";
import type { ViolationContract } from "src/reporting_protocols";
import type { LintStageTimerContract } from "src/shared_services_protocols";
import type { AstCacheEntryContract } from "src/source_protocols";

/** Responsibilities: _Python worker response_, _bridge timing_. **/
export type PythonAstBatchResultOptions = {
	readonly batch_id: string;
	readonly texts: readonly string[];
	readonly response: PythonAstWorkerResponse;
	readonly stage_timer: LintStageTimerContract;
	readonly stage_prefix: string;
};

/** Responsibilities: _Python import file index_. **/
export interface PythonImportFileIndexContract {
	directories(files: ReadonlySet<string>): Map<string, string[]>;
	for_root(root: string, files: ReadonlySet<string>): PythonImportRootIndexContract;
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
	append_assignment_violations(violations: ViolationContract[], file: string, callables: AstCallableNode[]): void;
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
	cancel_batch_ast?(batch_id: string): void;
}

/** Responsibilities: _Python source batch lifecycle_. **/
export interface PythonSourceFilesContract {
	begin_source_ast(stage_timer: LintStageTimerContract, stage_prefix: string): PythonSourceAstBatch;
	complete_source_ast(batch: PythonSourceAstBatch): ReadonlyMap<string, NormalizedAstFile>;
	cancel_source_ast(batch: PythonSourceAstBatch): void;
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
	resolve(options: PythonBatchAstOptions, parse: CallablePythonAstBatchParser): NormalizedAstFile[];
}

/** Responsibilities: _worker batch identity_, _batch lifecycle operations_. **/
export interface PythonAstWorkerBatchContract {
	/** Responsibilities: _batch source result_. **/
	result(): PythonAstWorkerResponse;
	/** Responsibilities: _batch source submission_. **/
	start(): void;
	/** Responsibilities: _batch response collection_. **/
	complete(): PythonAstWorkerResponse;
	/** Responsibilities: _batch cancellation_. **/
	cancel(): void;
}

/** Responsibilities: _Python worker batch access_. **/
export interface PythonAstWorkerCapabilityContract {
	/** Responsibilities: _batch capability creation_. **/
	batch(batch_id: string, sources: Map<string, string>): PythonAstWorkerBatchContract;
}

/** Responsibilities: _Python source batch execution_. **/
export interface PythonAstWorkerBatchOperationsContract {
	/** Responsibilities: _source parsing_, _batch response delivery_. **/
	batch_result(batch_id: string, sources: Map<string, string>): PythonAstWorkerResponse;
	/** Responsibilities: _concurrent batch submission_. **/
	start_batch(batch_id: string, sources: Map<string, string>): void;
	/** Responsibilities: _concurrent batch response collection_. **/
	complete_batch(batch_id: string): PythonAstWorkerResponse;
	/** Responsibilities: _concurrent batch cancellation_. **/
	cancel_batch(batch_id: string): void;
}

export type CallablePythonAstWorkerBatchOperations = () => PythonAstWorkerBatchOperationsContract;

/** Responsibilities: _Python source execution_, _worker shutdown authority_. **/
export interface PythonAstWorkerContract
	extends PythonAstWorkerBatchOperationsContract,
		PythonAstWorkerCapabilityContract {
	/** Responsibilities: _worker resource release_. **/
	close(): void;
	/** Responsibilities: _worker process completion_. **/
	wait_for_exit(): Promise<void>;
	/** Responsibilities: _worker process state_. **/
	has_exited(): boolean;
}

/** Responsibilities: _worker lease lifecycle_. **/
export interface PythonAstWorkerSessionContract {
	active(): boolean;
	worker(): PythonAstWorkerCapabilityContract;
	close(): Promise<void>;
}

/** Responsibilities: _worker lease ownership_. **/
export interface PythonAstWorkerLeaseOwnerContract {
	release_lease(key: string, lease_id: string): void;
}

/** Responsibilities: _worker session registration_, _process worker shutdown_. **/
export interface PythonAstWorkerRegistryContract {
	worker_session(worker_arguments: string[], worker_options: SpawnOptions): PythonAstWorkerSessionContract;
	close(): void;
}
