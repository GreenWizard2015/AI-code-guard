import type { PythonAstWorkerContract } from "src/core/python-ast-worker.mjs";
import type { IOContract } from "src/io/protocols";
import type { NormalizedAstFileContract } from "src/types";
import type { ReadonlyStringSet, StringSetMap, StringArrayMap } from "src/analysis_types";
import type { ProjectAnalysisIdentityContract } from "src/runtime_protocols";

export type PythonImportRootMap = Map<string, readonly string[]>;

export type PythonImportRootCache = WeakMap<ReadonlyStringSet, PythonImportRootMap>;

export type PythonImportPartCache = WeakMap<ReadonlyStringSet, StringSetMap>;

export type PythonDirectoryFilesCache = WeakMap<ReadonlyStringSet, StringArrayMap>;

export type PythonAstBatchParser = (texts: readonly string[]) => NormalizedAstFileContract[];

/** Responsibilities: _Python AST batch parsing_. **/
export type PythonAstDataOptions = {
	worker: PythonAstWorkerContract;
	analysis_identity: ProjectAnalysisIdentityContract;
	split_batch_enabled: boolean;
	file_io: IOContract;
};
