import type { NormalizedAstFile } from "src/model/ast/normalized_ast_types";
import type { PythonImportSessionContract } from "src/source_protocols";
import type { AbsoluteImportCandidate } from "src/source_types";

/** Responsibilities: _Python import root lookup_. **/
export interface PythonImportRootIndexContract {
	absolute_import_index(): PythonAbsoluteImportIndexContract;
	root_files(): readonly string[];
	importable_parts(): Set<string>;
	import_roots(): readonly string[];
}

/** Responsibilities: _absolute import index access_. **/
export interface PythonAbsoluteImportIndexContract {
	imports(): ReadonlyMap<string, AbsoluteImportCandidate>;
}

export type PythonFilePaths = ReadonlySet<string>;
export type PythonImportSessionCache = WeakMap<PythonFilePaths, PythonImportSessionContract>;
export type PythonDirectoryFiles = string[];
export type PythonImportableParts = Set<string>;
export type PythonImportRootMap = Map<string, PythonImportRootIndexContract>;
export type PythonImportRootCache = WeakMap<PythonFilePaths, PythonImportRootMap>;
export type PythonDirectoryMap = Map<string, PythonDirectoryFiles>;
export type PythonDirectoryFilesCache = WeakMap<PythonFilePaths, PythonDirectoryMap>;
export type PythonImportPartCache = Map<string, PythonImportableParts>;
export type CallablePythonAstBatchParser = (texts: readonly string[]) => NormalizedAstFile[];
