import { PUBLIC_FIELD_KIND } from "src/constants";
import { SourceReferenceIndex } from "src/core/source_reference_index";
import type { UnusedSourceImportCache, UnusedSymbolDefinition } from "src/core/types";
import { UnusedSymbolAliasIndex } from "src/linting/orchestration/runtime/global-analysis/unused_symbol_alias_index";
import { UnusedSymbolOwnership } from "src/linting/orchestration/runtime/global-analysis/unused-symbol-ownership/unused_symbol_ownership";
import { UnusedSymbolPropertyUsageIndex } from "src/linting/orchestration/runtime/global-analysis/unused-symbol-ownership/unused_symbol_property_usage_index";
import type { PendingUnusedSymbolReference } from "src/source_types";
import { UnusedSymbolImportIndex } from "src/linting/orchestration/runtime/global-analysis/unused-symbol-ownership/unused_symbol_import_index";
import type { ProjectSourceScannerContract } from "src/source_protocols";
import type { LintSourceRecord } from "src/source_types";

/** Responsibilities: _unused symbol usage binding_, _import ownership resolution_. **/
export class UnusedSymbolReferenceIndex {
	private readonly references: SourceReferenceIndex<string>;
	private readonly import_index: UnusedSymbolImportIndex;
	private readonly alias_index: UnusedSymbolAliasIndex;
	private readonly ownership: UnusedSymbolOwnership;
	private readonly property_usage_index: UnusedSymbolPropertyUsageIndex;
	private readonly pending_references: PendingUnusedSymbolReference[];

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
		for (const definition of this.import_index.imported_definitions(source, name)) {
			this.references.add_usage(`${definition.file}\u0000${definition.name}`, {
				file: source.relative_path,
				line,
			});
		}
	}

	/** Responsibilities: _pending source reference finalization_. **/
	private finalize_references(): void {
		const pending = this.pending_references.splice(0);
		for (const reference of pending) {
			this.add_source_reference(reference.source, reference.name, reference.line);
		}
	}

	/** Responsibilities: _unused symbol index state_. **/
	public constructor(
		scanner: ProjectSourceScannerContract,
		available_files: Set<string>,
		definitions_by_file: ReadonlyMap<string, readonly UnusedSymbolDefinition[]>,
	) {
		const import_cache: UnusedSourceImportCache = new Map<string, ReadonlySet<string>>();
		this.alias_index = new UnusedSymbolAliasIndex();
		this.references = new SourceReferenceIndex<string>();
		this.import_index = new UnusedSymbolImportIndex(
			scanner,
			available_files,
			definitions_by_file,
			import_cache,
			this.alias_index,
		);
		this.ownership = new UnusedSymbolOwnership(scanner, available_files, definitions_by_file, import_cache);
		this.property_usage_index = new UnusedSymbolPropertyUsageIndex(this.references, this.ownership);
		this.pending_references = [];
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

	/** Responsibilities: _external symbol usage indexing_. **/
	public add_external_usage(file: string, name: string): void {
		this.references.add_usage(`${file}\u0000${name}`, { file, line: 0 });
	}

	/** Responsibilities: _source usage collection_. **/
	public add_source(source: LintSourceRecord): void {
		this.alias_index.add_source(source);
		this.import_index.add_source(source);
		const references = source.normalized_ast.symbol_references;
		if (Array.isArray(references)) {
			for (const reference of references) {
				this.pending_references.push({ source, name: reference.name, line: reference.line + 1 });
			}
		}
		this.property_usage_index.add_source(source);
	}

	/** Responsibilities: _unused symbol reference presence_. **/
	public usage_present(definition: UnusedSymbolDefinition): boolean {
		this.finalize_references();
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
