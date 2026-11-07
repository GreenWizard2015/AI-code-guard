import type { PythonAstWorkerRegistryEntry } from "src/core/python-ast/types";

/** Responsibilities: _Python AST worker timeout_, _process worker registry_. **/
export const PYTHON_AST_WORKER_IO_TIMEOUT_MS = 10000;
export const PYTHON_AST_STAGE_PREFIX = "python-bridge";
export const PYTHON_AST_INCOMPLETE_BATCH_MESSAGE = "Python AST worker returned an incomplete batch.";
export const PYTHON_AST_PARSE_STAGE = "python-ast-parse";
export const PYTHON_AST_BUILD_STAGE = "python-ast-build";
export const PYTHON_AST_UNEXPECTED_BATCH_ID_MESSAGE = "Python AST worker returned an unexpected batch id.";
export const PYTHON_AST_UNEXPECTED_LANGUAGE_MESSAGE = "Python AST bridge returned an unexpected language.";
export const PYTHON_AST_EMPTY_SOURCE_RESULT_MESSAGE = "Python AST bridge returned no result for one source.";
export const PYTHON_AST_MISSING_SPLIT_BATCH_MESSAGE = "Python AST split batch is missing.";
export const PYTHON_AST_MISSING_BATCH_SOURCE_MESSAGE = "Python AST batch source is missing.";
export const PYTHON_AST_MISSING_BATCH_RESULT_MESSAGE = "Python AST batch result is missing.";
export const PYTHON_AST_INCOMPLETE_CACHE_BATCH_MESSAGE = "Python AST bridge returned an incomplete batch.";
export const PYTHON_AST_SPLIT_BATCH_COMPLETION_UNAVAILABLE_MESSAGE =
	"Python AST split batch completion is unavailable.";
export const PYTHON_AST_SPLIT_BATCH_CLEANUP_UNAVAILABLE_MESSAGE = "Python AST split batch cleanup is unavailable.";
export const PYTHON_AST_WORKER_REGISTRIES = new WeakMap<NodeJS.Process, Map<string, PythonAstWorkerRegistryEntry>>();
export const PYTHON_AST_WORKER_INACTIVE_LEASE_MESSAGE = "Python AST worker lease is no longer active.";
