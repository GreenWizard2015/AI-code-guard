import type ts from "typescript";

/** Responsibilities: _source-file map lookup_. **/
export interface SourceFileMapContract extends ReadonlyMap<string, ts.SourceFile> {}

/** Responsibilities: _source file resolution_. **/
export interface SourceFileResolverContract {
	source_file(file: string): ts.SourceFile;
	contains_source_file(file: string): boolean;
}

/** Responsibilities: _map-scoped source resolver reuse_, _source map ownership_. **/
export interface SourceFileMapResolverCacheContract {
	for_map(source_files: SourceFileMapContract): SourceFileResolverContract;
	refresh_map(source_files: SourceFileMapContract): SourceFileResolverContract;
}

/** Responsibilities: _owner-scoped source resolver cache_. **/
export type SourceFileResolverCache = WeakMap<SourceFileMapContract, SourceFileResolverContract>;

/** Responsibilities: _Worker module reference index_. **/
export type WorkerModuleReferences = {
	readonly worker_names: ReadonlySet<string>;
	readonly paths_by_field: ReadonlyMap<string, readonly string[]>;
	readonly constructions: readonly ts.NewExpression[];
	readonly module_paths: readonly string[];
};

/** Responsibilities: _Worker URL path cache_. **/
export type WorkerUrlPathAlternatives = WeakMap<ts.Expression, readonly string[]>;

/** Responsibilities: _Worker entry URL reference_. **/
export type WorkerEntryPathRequest = {
	readonly expression: ts.Expression;
	readonly source_file: ts.SourceFile;
};

/** Responsibilities: _Worker URL path alternatives_. **/
export interface WorkerUrlPathsContract {
	paths(expression: ts.Expression): readonly string[];
	entry_paths(request: WorkerEntryPathRequest): readonly string[];
}
