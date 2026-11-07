import type { SpawnOptions } from "node:child_process";
import type { IOContract } from "src/io/protocols";
import type {
	NormalizedAstFile,
	PythonAstCachePreparation,
	PythonBatchAstOptions,
} from "src/model/ast/normalized_ast_types";
import type {
	PythonAstWorkerBatchContract,
	PythonAstWorkerCapabilityContract,
	PythonAstWorkerContract,
	PythonAstWorkerLeaseOwnerContract,
} from "src/python_protocols";
import type { ProjectAnalysisIdentityContract } from "src/runtime_protocols";

/** Responsibilities: _worker source collection_, _worker response shape_. **/
export type PythonAstWorkerAsts = ReadonlyMap<string, NormalizedAstFile>;
export type PythonAstStageTiming = { name: string; duration_ms: number };
export type PythonAstWorkerTimings = {
	ast_parse_ms: number;
	ast_build_ms: number;
	ast_stages: PythonAstStageTiming[];
};
export type PythonAstWorkerResponse = {
	batch_id: string;
	asts: PythonAstWorkerAsts;
	timings: PythonAstWorkerTimings;
};

/** Responsibilities: _Python AST worker construction_. **/
export type PythonAstWorkerOptions = {
	arguments_list: string[];
	options: SpawnOptions;
	persistent: boolean;
	io_timeout_ms: number;
};

/** Responsibilities: _process worker lease ownership_. **/
export type PythonAstWorkerRegistryEntry = {
	worker: PythonAstWorkerContract;
	leases: Set<string>;
};

/** Responsibilities: _Python AST parser configuration_. **/
export type PythonAstBridgeOptions = {
	readonly worker: PythonAstWorkerCapabilityContract;
	readonly analysis_identity: ProjectAnalysisIdentityContract;
	readonly split_batch_enabled: boolean;
	readonly file_io: IOContract;
	readonly cache_enabled: boolean;
};

/** Responsibilities: _worker session state_. **/
export type PythonAstWorkerSessionOptions = {
	workers: Map<string, PythonAstWorkerRegistryEntry>;
	key: string;
	lease_id: string;
	worker_instance: PythonAstWorkerContract;
	lease_owner: PythonAstWorkerLeaseOwnerContract;
};

/** Responsibilities: _pending Python batch state_, _worker batch ownership_. **/
export type PythonBatchAstPreparation = {
	options: PythonBatchAstOptions;
	cache: PythonAstCachePreparation;
	worker_batch: PythonAstWorkerBatchContract;
	started_at: number;
};
