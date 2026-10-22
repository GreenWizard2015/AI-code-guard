import type {
	UnusedDefinitionMatches,
	UnusedImportedDefinitionCache,
	UnusedSourceImportCache,
	UnusedSymbolDefinition,
	UnusedSymbolFileBuckets,
	UnusedSymbolNameBuckets,
} from "src/core/types";
import type { ProjectSourceScannerContract } from "src/source_protocols";
import type { UnusedSymbolAliasIndexContract } from "src/linting/orchestration/runtime/global-analysis/protocols";
import type { AstPythonImport, AstPythonImportName } from "src/types";
import type { LintSourceRecord } from "src/source_types";

/** Responsibilities: _imported symbol ownership_, _Python re-export indexing_. **/
export class UnusedSymbolImportIndex {
	private readonly scanner: ProjectSourceScannerContract;
	private readonly available_files: Set<string>;
	private readonly definitions_by_file: ReadonlyMap<string, readonly UnusedSymbolDefinition[]>;
	private readonly definitions_by_name: UnusedSymbolFileBuckets;
	private readonly import_cache: UnusedSourceImportCache;
	private readonly imported_definition_cache: UnusedImportedDefinitionCache;
	private readonly alias_index: UnusedSymbolAliasIndexContract;
	private readonly sources_by_path: Map<string, LintSourceRecord>;

	/** Responsibilities: _per-name definition registration_. **/
	private append_definition(definitions_by_name: UnusedSymbolNameBuckets, definition: UnusedSymbolDefinition): void {
		let matching = definitions_by_name.get(definition.name);
		if (matching === undefined) {
			matching = [];
			definitions_by_name.set(definition.name, matching);
		}
		matching.push(definition);
	}

	/** Responsibilities: _per-file definition name lookup_. **/
	private definitions_for_file(file: string): UnusedSymbolNameBuckets {
		const cached = this.definitions_by_name.get(file);
		if (cached !== undefined) {
			return cached;
		}
		const names: UnusedSymbolNameBuckets = new Map<string, UnusedSymbolDefinition[]>();
		const definitions = this.definitions_by_file.get(file);
		if (definitions !== undefined) {
			for (const definition of definitions) {
				this.append_definition(names, definition);
			}
		}
		this.definitions_by_name.set(file, names);
		return names;
	}

	/** Responsibilities: _Python imported name resolution_. **/
	private resolve_python_reexports(
		source: LintSourceRecord,
		name: string,
		visited: Set<string>,
	): UnusedDefinitionMatches {
		if (!source.python() || !this.mark_visited(source, name, visited)) {
			return [];
		}
		const matches: UnusedSymbolDefinition[] = [];
		for (const item of source.normalized_ast.python_imports) {
			matches.push(...this.imported_item_definitions(source, item, name, visited));
		}
		return matches;
	}

	/** Responsibilities: _Python re-export traversal state_. **/
	private mark_visited(source: LintSourceRecord, name: string, visited: Set<string>): boolean {
		const key = `${source.absolute_path}\u0000${name}`;
		if (visited.has(key)) {
			return false;
		}
		visited.add(key);
		return true;
	}

	/** Responsibilities: _Python import target resolution_. **/
	private imported_item_definitions(
		source: LintSourceRecord,
		item: AstPythonImport,
		name: string,
		visited: Set<string>,
	): UnusedDefinitionMatches {
		if (item.kind !== "from") {
			return [];
		}
		const target_path = this.scanner.resolved_import_path(source.absolute_path, item.module, this.available_files);
		const target = this.sources_by_path.get(target_path);
		if (target === undefined) {
			return [];
		}
		return item.names.flatMap((imported) => this.imported_name_definitions(source, target, imported, name, visited));
	}

	/** Responsibilities: _Python import alias ownership_. **/
	private imported_name_definitions(
		source: LintSourceRecord,
		target: LintSourceRecord,
		imported: AstPythonImportName,
		name: string,
		visited: Set<string>,
	): UnusedDefinitionMatches {
		if (imported.name === "*") {
			return this.wildcard_definitions(target, name, visited);
		}
		let local_name = imported.name;
		if (imported.alias) {
			local_name = imported.alias;
		}
		if (!this.alias_index.names(source, name).includes(local_name)) {
			return [];
		}
		return this.definitions_or_reexports(target, imported.name, visited);
	}

	/** Responsibilities: _Python wildcard export resolution_. **/
	private wildcard_definitions(target: LintSourceRecord, name: string, visited: Set<string>): UnusedDefinitionMatches {
		if (!target.normalized_ast.python_exports.includes(name)) {
			return [];
		}
		return this.definitions_or_reexports(target, name, visited);
	}

	/** Responsibilities: _Python declaration candidates_. **/
	private definitions_or_reexports(
		target: LintSourceRecord,
		name: string,
		visited: Set<string>,
	): UnusedDefinitionMatches {
		const definitions = this.definitions_for_file(target.absolute_path).get(name);
		if (definitions !== undefined) {
			if (definitions.length > 0) {
				return definitions;
			}
		}
		return this.resolve_python_reexports(target, name, visited);
	}

	/** Responsibilities: _imported source definition resolution_. **/
	private resolve_imported_definitions(source: LintSourceRecord, name: string): UnusedDefinitionMatches {
		const matches: UnusedSymbolDefinition[] = [];
		const reference_names = this.alias_index.names(source, name);
		for (const imported_file of this.source_imports(source)) {
			const definitions = this.definitions_for_file(imported_file);
			matches.push(...this.named_definitions(definitions, reference_names));
		}
		matches.push(...this.resolve_python_reexports(source, name, new Set<string>()));
		return matches;
	}

	/** Responsibilities: _imported name definition matching_. **/
	private named_definitions(definitions: UnusedSymbolNameBuckets, names: readonly string[]): UnusedDefinitionMatches {
		const matches: UnusedSymbolDefinition[] = [];
		for (const name of names) {
			const named = definitions.get(name);
			if (named !== undefined) {
				matches.push(...named);
			}
		}
		return matches;
	}

	/** Responsibilities: _source import caching_. **/
	private source_imports(source: LintSourceRecord): ReadonlySet<string> {
		const cached = this.import_cache.get(source.absolute_path);
		if (cached !== undefined) {
			return cached;
		}
		const resolved = this.scanner.resolved_imports(source.absolute_path, this.available_files);
		this.import_cache.set(source.absolute_path, resolved);
		return resolved;
	}

	/** Responsibilities: _import resolution cache initialization_. **/
	public constructor(
		scanner: ProjectSourceScannerContract,
		available_files: Set<string>,
		definitions_by_file: ReadonlyMap<string, readonly UnusedSymbolDefinition[]>,
		import_cache: UnusedSourceImportCache,
		alias_index: UnusedSymbolAliasIndexContract,
	) {
		this.scanner = scanner;
		this.available_files = available_files;
		this.definitions_by_file = definitions_by_file;
		this.definitions_by_name = new Map<string, UnusedSymbolNameBuckets>();
		this.import_cache = import_cache;
		this.imported_definition_cache = new Map<string, Map<string, UnusedDefinitionMatches>>();
		this.alias_index = alias_index;
		this.sources_by_path = new Map<string, LintSourceRecord>();
	}

	/** Responsibilities: _source import ownership_. **/
	public add_source(source: LintSourceRecord): void {
		this.sources_by_path.set(source.absolute_path, source);
	}

	/** Responsibilities: _imported definition memoization_. **/
	public imported_definitions(source: LintSourceRecord, name: string): UnusedDefinitionMatches {
		let source_cache = this.imported_definition_cache.get(source.absolute_path);
		if (source_cache === undefined) {
			source_cache = new Map<string, UnusedDefinitionMatches>();
			this.imported_definition_cache.set(source.absolute_path, source_cache);
		}
		const cached = source_cache.get(name);
		if (cached !== undefined) {
			return cached;
		}
		const matches = this.resolve_imported_definitions(source, name);
		source_cache.set(name, matches);
		return matches;
	}
}
