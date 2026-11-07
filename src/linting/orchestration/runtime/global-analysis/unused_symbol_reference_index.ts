import { PUBLIC_FIELD_KIND } from "src/constants";
import type { UnusedSymbolReferenceIndexContract } from "src/contracts/protocols/global_analysis_protocols";
import { SourceReferenceIndex } from "src/core/source_reference_index";
import type { UnusedSourceImportCache, UnusedSymbolDefinition } from "src/core/types";
import { UnusedSymbolImportIndex } from "src/linting/orchestration/runtime/global-analysis/unused-symbol-ownership/unused_symbol_import_index";
import { UnusedSymbolOwnership } from "src/linting/orchestration/runtime/global-analysis/unused-symbol-ownership/unused_symbol_ownership";
import { UnusedSymbolPropertyUsageIndex } from "src/linting/orchestration/runtime/global-analysis/unused-symbol-ownership/unused_symbol_property_usage_index";
import { UnusedSymbolAliasIndex } from "src/linting/orchestration/runtime/global-analysis/unused_symbol_alias_index";
import type { ProjectSourceScanContract } from "src/source_protocols";
import type { PendingUnusedSymbolReference } from "src/source_types";
import type { LintSourceRecordData } from "src/source_types";

/** Responsibilities: _unused symbol usage binding_, _import ownership resolution_. **/
export class UnusedSymbolReferenceIndex implements UnusedSymbolReferenceIndexContract {
	private readonly _references: SourceReferenceIndex<string>;
	private readonly _import_index: UnusedSymbolImportIndex;
	private readonly _alias_index: UnusedSymbolAliasIndex;
	private readonly _ownership: UnusedSymbolOwnership;
	private readonly _property_usage_index: UnusedSymbolPropertyUsageIndex;
	private readonly _pending_references: PendingUnusedSymbolReference[];

	/** Responsibilities: _source usage indexing_. **/
	private add_source_reference(source: LintSourceRecordData, name: string, line: number): void {
		if (this._ownership.parameter_shadow(source, name, line)) {
			return;
		}
		for (const reference_name of this._alias_index.names(source, name)) {
			this._references.add_usage_once(`${source.relative_path}\u0000${reference_name}`, source.relative_path, line);
		}
		for (const definition of this._import_index.imported_definitions(source.absolute_path, name)) {
			this._references.add_usage_once(`${definition.file}\u0000${definition.name}`, source.relative_path, line);
		}
	}

	/** Responsibilities: _pending source reference finalization_. **/
	private finalize_references(): void {
		const pending = this._pending_references.splice(0);
		for (const reference of pending) {
			this.add_source_reference(reference.source, reference.name, reference.line);
		}
	}

	/** Responsibilities: _unused symbol index state_. **/
	public constructor(
		scanner: ProjectSourceScanContract,
		available_files: Set<string>,
		definitions_by_file: ReadonlyMap<string, readonly UnusedSymbolDefinition[]>,
	) {
		const import_cache: UnusedSourceImportCache = new Map<string, ReadonlySet<string>>();
		this._alias_index = new UnusedSymbolAliasIndex();
		this._references = new SourceReferenceIndex<string>();
		this._import_index = new UnusedSymbolImportIndex(
			scanner,
			available_files,
			definitions_by_file,
			import_cache,
			this._alias_index,
		);
		this._ownership = new UnusedSymbolOwnership(scanner, available_files, definitions_by_file, import_cache);
		this._property_usage_index = new UnusedSymbolPropertyUsageIndex(this._references, this._ownership);
		this._pending_references = [];
	}

	/** Responsibilities: _unused symbol implementation indexing_. **/
	public add_implementation(definition: UnusedSymbolDefinition): void {
		this._references.add_implementation(`${definition.file}\u0000${definition.name}`, {
			file: definition.file,
			line: definition.line,
		});
		if (definition.kind === PUBLIC_FIELD_KIND) {
			const key = `field\u0000${definition.file}\u0000${definition.owner}\u0000${definition.name}`;
			this._references.add_implementation(key, { file: definition.file, line: definition.line });
		}
	}

	/** Responsibilities: _external symbol usage indexing_. **/
	public add_external_usage(file: string, name: string): void {
		this._references.add_usage_once(`${file}\u0000${name}`, file, 0);
	}

	/** Responsibilities: _source usage collection_. **/
	public add_source(source: LintSourceRecordData): void {
		this._alias_index.add_source(source);
		this._import_index.add_source(source);
		const references = source.normalized_ast.references.symbol_references;
		if (Array.isArray(references)) {
			for (const reference of references) {
				this._pending_references.push({ source, name: reference.name, line: reference.line + 1 });
			}
		}
		this._property_usage_index.add_source(source);
	}

	/** Responsibilities: _unused symbol reference presence_. **/
	public usage_present(definition: UnusedSymbolDefinition): boolean {
		this.finalize_references();
		const exact_key = `${definition.file}\u0000${definition.name}`;
		if (this._references.references_for(exact_key, "usage").length > 0) {
			return true;
		}
		if (definition.kind !== PUBLIC_FIELD_KIND) {
			return false;
		}
		return this._property_usage_index.usage_present(definition);
	}
}
