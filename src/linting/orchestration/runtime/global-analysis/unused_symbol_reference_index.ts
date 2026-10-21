import { PUBLIC_FIELD_KIND } from "src/constants";
import { SourceReferenceIndex } from "src/core/source_reference_index";
import type {
	UnusedDefinitionMatches,
	UnusedImportedDefinitionCache,
	UnusedSourceImportCache,
	UnusedSourceImportFiles,
	UnusedSymbolDefinition,
	UnusedSymbolFileBuckets,
	UnusedSymbolNameBuckets,
} from "src/core/types";
import { UnusedSymbolOwnership } from "src/linting/orchestration/runtime/global-analysis/unused-symbol-ownership/unused_symbol_ownership";
import { UnusedSymbolAliasIndex } from "src/linting/orchestration/runtime/global-analysis/unused_symbol_alias_index";
import { UnusedSymbolPropertyUsageIndex } from "src/linting/orchestration/runtime/global-analysis/unused-symbol-ownership/unused_symbol_property_usage_index";
import type { ProjectSourceScannerContract } from "src/source_protocols";
import type { LintSourceRecord } from "src/source_types";

/** Responsibilities: _unused symbol usage binding_, _import ownership resolution_. **/
export class UnusedSymbolReferenceIndex {
	private readonly references: SourceReferenceIndex<string>;
	private readonly scanner: ProjectSourceScannerContract;
	private readonly available_files: Set<string>;
	private readonly definitions_by_file: ReadonlyMap<string, readonly UnusedSymbolDefinition[]>;
	private readonly definitions_by_name: Map<string, UnusedSymbolNameBuckets>;
	private readonly import_cache: UnusedSourceImportCache;
	private readonly imported_definition_cache: UnusedImportedDefinitionCache;
	private readonly alias_index: UnusedSymbolAliasIndex;
	private readonly ownership: UnusedSymbolOwnership;
	private readonly property_usage_index: UnusedSymbolPropertyUsageIndex;

	/** Responsibilities: _definition name bucket preparation_. **/
	private definition_name_buckets(): UnusedSymbolFileBuckets {
		const buckets = new Map<string, Map<string, UnusedSymbolDefinition[]>>();
		for (const [file, definitions] of this.definitions_by_file) {
			const names = new Map<string, UnusedSymbolDefinition[]>();
			for (const definition of definitions) {
				let matching = names.get(definition.name);
				if (matching === undefined) {
					matching = [];
					names.set(definition.name, matching);
				}
				matching.push(definition);
			}
			buckets.set(file, names);
		}
		return buckets;
	}

	/** Responsibilities: _source import cache_. **/
	private source_imports(source: LintSourceRecord): ReadonlySet<string> {
		const cached = this.import_cache.get(source.absolute_path);
		if (cached !== undefined) {
			return cached;
		}
		const resolved = this.scanner.resolved_imports(source.absolute_path, this.available_files);
		this.import_cache.set(source.absolute_path, resolved);
		return resolved;
	}

	/** Responsibilities: _imported definition name resolution_. **/
	private resolve_imported_definitions(source: LintSourceRecord, name: string): UnusedDefinitionMatches {
		const matches: UnusedSymbolDefinition[] = [];
		const reference_names = this.alias_index.names(source, name);
		for (const imported_file of this.source_imports(source)) {
			const definitions = this.definitions_by_name.get(imported_file);
			if (definitions === undefined) {
				continue;
			}
			for (const reference_name of reference_names) {
				const named_definitions = definitions.get(reference_name);
				if (named_definitions === undefined) {
					continue;
				}
				matches.push(...named_definitions);
			}
		}
		return matches;
	}

	/** Responsibilities: _imported definition resolution memoization_. **/
	private imported_definitions(source: LintSourceRecord, name: string): UnusedDefinitionMatches {
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

	/** Responsibilities: _source usage indexing_. **/
	private add_source_reference(source: LintSourceRecord, name: string, line: number): void {
		if (this.ownership.parameter_shadow(source, name, line)) {
			return;
		}
		for (const reference_name of this.alias_index.names(source, name)) {
			this.references.add_usage(`${source.relative_path}\u0000${reference_name}`, {
				file: source.relative_path,
				line,
			});
		}
		for (const definition of this.imported_definitions(source, name)) {
			this.references.add_usage(`${definition.file}\u0000${definition.name}`, {
				file: source.relative_path,
				line,
			});
		}
	}

	/** Responsibilities: _unused symbol index state_. **/
	public constructor(
		scanner: ProjectSourceScannerContract,
		available_files: Set<string>,
		definitions_by_file: ReadonlyMap<string, readonly UnusedSymbolDefinition[]>,
	) {
		this.references = new SourceReferenceIndex<string>();
		this.scanner = scanner;
		this.available_files = available_files;
		this.definitions_by_file = definitions_by_file;
		this.definitions_by_name = new Map<string, UnusedSymbolNameBuckets>();
		this.import_cache = new Map<string, UnusedSourceImportFiles>();
		this.imported_definition_cache = new Map<string, Map<string, readonly UnusedSymbolDefinition[]>>();
		this.alias_index = new UnusedSymbolAliasIndex();
		this.ownership = new UnusedSymbolOwnership(scanner, available_files, definitions_by_file, this.import_cache);
		this.property_usage_index = new UnusedSymbolPropertyUsageIndex(this.references, this.ownership);
	}

	/** Responsibilities: _definition name index preparation_. **/
	public prepare(): void {
		for (const [file, names] of this.definition_name_buckets()) {
			this.definitions_by_name.set(file, names);
		}
	}

	/** Responsibilities: _unused symbol implementation indexing_. **/
	public add_implementation(definition: UnusedSymbolDefinition): void {
		this.references.add_implementation(`${definition.file}\u0000${definition.name}`, {
			file: definition.file,
			line: definition.line,
		});
		if (definition.kind === PUBLIC_FIELD_KIND) {
			const key = `field\u0000${definition.file}\u0000${definition.owner}\u0000${definition.name}`;
			this.references.add_implementation(key, { file: definition.file, line: definition.line });
		}
	}

	/** Responsibilities: _source usage collection_. **/
	public add_source(source: LintSourceRecord): void {
		this.alias_index.add_source(source);
		const references = source.normalized_ast.symbol_references;
		if (Array.isArray(references)) {
			for (const reference of references) {
				this.add_source_reference(source, reference.name, reference.line + 1);
			}
		}
		this.property_usage_index.add_source(source);
	}

	/** Responsibilities: _unused symbol reference presence_. **/
	public usage_present(definition: UnusedSymbolDefinition): boolean {
		const exact_key = `${definition.file}\u0000${definition.name}`;
		if (this.references.references_for(exact_key, "usage").length > 0) {
			return true;
		}
		if (definition.kind !== PUBLIC_FIELD_KIND) {
			return false;
		}
		return this.property_usage_index.usage_present(definition);
	}
}
