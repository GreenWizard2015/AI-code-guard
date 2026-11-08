import { TYPESCRIPT_LANGUAGE } from "src/constants";
import type {
	PythonExportNamesByFile,
	PythonReexportGraphContract,
	PythonReexportGraphOptions,
	TypeScriptReexportGraphContract,
	UnusedSymbolAliasIndexContract,
	UnusedSymbolDefinitionLookupContract,
	UnusedSymbolFileNameBucketsContract,
	UnusedSymbolImportIndexContract,
} from "src/contracts/protocols/global_analysis_protocols";
import type {
	UnusedDefinitionMatches,
	UnusedImportedDefinitionCache,
	UnusedImporterDefinitionBuckets,
	UnusedImporterNameBuckets,
	UnusedSourceImportCache,
	UnusedSymbolDefinition,
} from "src/core/types";
import { PythonReexportGraph } from "src/linting/orchestration/runtime/global-analysis/unused-symbol-ownership/python_reexport_graph";
import { PythonReexportTraversal } from "src/linting/orchestration/runtime/global-analysis/unused-symbol-ownership/python_reexport_traversal";
import { TypeScriptReexportGraph } from "src/linting/orchestration/runtime/global-analysis/unused-symbol-ownership/type_script_reexport/type_script_reexport_graph";
import { UnusedSymbolAliasIndex } from "src/linting/orchestration/runtime/global-analysis/unused-symbol-ownership/unused_symbol_alias_index";
import { UnusedSymbolDefinitionLookup } from "src/linting/orchestration/runtime/global-analysis/unused-symbol-ownership/unused_symbol_definition_lookup";
import type { ProjectSourceScanContract } from "src/source_protocols";
import type { LintSourceRecordData, PendingUnusedSymbolReference } from "src/source_types";

/** Responsibilities: _imported definition indexing_, _language-specific re-export resolution_, _source registration invalidation_. **/
export class UnusedSymbolImportIndex implements UnusedSymbolImportIndexContract {
	private readonly _scanner: ProjectSourceScanContract;
	private readonly _available_files: Set<string>;
	private readonly _import_cache: UnusedSourceImportCache;
	private readonly _imported_definition_cache: UnusedImportedDefinitionCache;
	private readonly _definitions_by_importer: UnusedImporterDefinitionBuckets;
	private readonly _alias_index: UnusedSymbolAliasIndexContract;
	private readonly _definitions: UnusedSymbolDefinitionLookupContract;
	private readonly _sources_by_path: Map<string, LintSourceRecordData>;
	private readonly _exports_by_file: PythonExportNamesByFile;
	private readonly _python_reexports: PythonReexportGraphContract;
	private readonly _typescript_reexports: TypeScriptReexportGraphContract;

	/** Responsibilities: _source import lookup_. **/
	private source_imports(importer: LintSourceRecordData): ReadonlySet<string> {
		const cached = this._import_cache.get(importer.absolute_path);
		if (cached !== undefined) {
			return cached;
		}
		const resolved = this._scanner.imports(importer.absolute_path, this._available_files).resolved_targets();
		this._import_cache.set(importer.absolute_path, resolved);
		return resolved;
	}

	/** Responsibilities: _imported file definition buckets_. **/
	private append_file_definitions(by_name: UnusedImporterNameBuckets, imported_file: string): void {
		for (const definition of this._definitions.for_file(imported_file).all()) {
			let matches = by_name.get(definition.name);
			if (matches === undefined) {
				matches = [];
				by_name.set(definition.name, matches);
			}
			matches.push(definition);
		}
	}

	/** Responsibilities: _referenced definition lookup_. **/
	private local_definitions(
		reference_names: readonly string[],
		source_definitions: UnusedSymbolFileNameBucketsContract,
		imported_definitions: UnusedImporterNameBuckets,
	): UnusedSymbolDefinition[] {
		const matches: UnusedSymbolDefinition[] = [];
		for (const reference_name of reference_names) {
			matches.push(...source_definitions.exact(reference_name));
			matches.push(...(imported_definitions.get(reference_name) ?? []));
		}
		return matches;
	}

	/** Responsibilities: _reference definition lookup_. **/
	private append_language_reexports(
		source: LintSourceRecordData,
		symbol_name: string,
		matches: UnusedSymbolDefinition[],
	): void {
		const traversal = new PythonReexportTraversal(source, symbol_name, new Set(), new Set());
		matches.push(...this._python_reexports.resolve(traversal));
		if (source.language === TYPESCRIPT_LANGUAGE) {
			matches.push(...this._typescript_reexports.resolve_import(source.absolute_path, symbol_name));
		}
	}

	/** Responsibilities: _source reference definition lookup_. **/
	private resolve_reference_definitions(reference: PendingUnusedSymbolReference): UnusedDefinitionMatches {
		const { source, name } = reference;
		if (!this._sources_by_path.has(source.absolute_path)) {
			throw new Error(`Missing registered source: ${source.absolute_path}`);
		}
		const reference_names = this._alias_index.names(source, name);
		const definitions_by_name = this._definitions_by_importer.get(source.absolute_path);
		if (definitions_by_name === undefined) {
			throw new Error(`Missing import definitions: ${source.absolute_path}`);
		}
		const source_definitions = this._definitions.for_file(source.absolute_path);
		const matches = this.local_definitions(reference_names, source_definitions, definitions_by_name);
		this.append_language_reexports(source, name, matches);
		return matches;
	}

	/** Responsibilities: _import index initialization_. **/
	public constructor(
		scanner: ProjectSourceScanContract,
		available_files: Set<string>,
		definitions_by_file: ReadonlyMap<string, readonly UnusedSymbolDefinition[]>,
		import_cache: UnusedSourceImportCache,
	) {
		this._scanner = scanner;
		this._available_files = available_files;
		this._definitions = new UnusedSymbolDefinitionLookup(definitions_by_file);
		this._import_cache = import_cache;
		this._imported_definition_cache = new Map<string, Map<string, UnusedDefinitionMatches>>();
		this._definitions_by_importer = new Map();
		this._alias_index = new UnusedSymbolAliasIndex();
		this._sources_by_path = new Map<string, LintSourceRecordData>();
		this._exports_by_file = new Map<string, ReadonlySet<string>>();
		const reexport_options: PythonReexportGraphOptions = {
			scanner,
			available_files,
			alias_index: this._alias_index,
			definitions: this._definitions,
			sources_by_path: this._sources_by_path,
			exports_by_file: this._exports_by_file,
		};
		this._python_reexports = new PythonReexportGraph(reexport_options);
		this._typescript_reexports = new TypeScriptReexportGraph(
			scanner,
			available_files,
			this._sources_by_path,
			definitions_by_file,
		);
	}

	/** Responsibilities: _source and export registration_. **/
	public add_source(source: LintSourceRecordData): void {
		this._sources_by_path.set(source.absolute_path, source);
		this._alias_index.add_source(source);
		this._typescript_reexports.invalidate();
		this._import_cache.clear();
		this._imported_definition_cache.clear();
		const by_name: UnusedImporterNameBuckets = new Map();
		for (const imported_file of this.source_imports(source)) {
			this.append_file_definitions(by_name, imported_file);
		}
		this._definitions_by_importer.set(source.absolute_path, by_name);
		if (source.language === "python") {
			this._exports_by_file.set(
				source.absolute_path,
				new Set(source.normalized_ast.module_declarations.python_exports),
			);
		}
	}

	/** Responsibilities: _imported definition memoization_. **/
	public imported_definitions(reference: PendingUnusedSymbolReference): UnusedDefinitionMatches {
		const { source, name } = reference;
		const source_file = source.absolute_path;
		let source_cache = this._imported_definition_cache.get(source_file);
		if (source_cache === undefined) {
			source_cache = new Map<string, UnusedDefinitionMatches>();
			this._imported_definition_cache.set(source_file, source_cache);
		}
		const cached = source_cache.get(name);
		if (cached !== undefined) {
			return cached;
		}
		const matches = this.resolve_reference_definitions(reference);
		source_cache.set(name, matches);
		return matches;
	}
}
