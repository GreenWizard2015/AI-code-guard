import { PUBLIC_FIELD_KIND } from "src/constants";
import type {
	UnusedFieldUsageKey,
	UnusedSymbolImportIndexContract,
	UnusedSymbolParameterShadowContract,
	UnusedSymbolPropertyOwnershipContract,
	UnusedSymbolPropertyUsageIndexContract,
	UnusedSymbolReferenceIndexContract,
	UnusedSymbolUsageKey,
	UnusedSymbolUsageStoreContract,
} from "src/contracts/protocols/global_analysis_protocols";
import { SourceReferenceIndex } from "src/core/source_reference_index";
import type {
	UnusedFieldUsageByFile,
	UnusedFieldUsageByOwner,
	UnusedSourceImportCache,
	UnusedSymbolDefinition,
	UnusedSymbolUsageByFile,
} from "src/core/types";
import { UnusedSymbolImportIndex } from "src/rules/typescript/syntax-rules/ast/verifier/project-rules/unused_symbol_rules/indexes/unused_symbol_import_index";
import { UnusedSymbolOwnership } from "src/rules/typescript/syntax-rules/ast/verifier/project-rules/unused_symbol_rules/indexes/unused_symbol_ownership";
import { UnusedSymbolPropertyUsageIndex } from "src/rules/typescript/syntax-rules/ast/verifier/project-rules/unused_symbol_rules/indexes/unused_symbol_property_usage_index";
import type { SourceReferenceIndexContract } from "src/shared_services_protocols";
import type { ProjectSourceScanContract } from "src/source_protocols";
import type { LintSourceRecordData, PendingUnusedSymbolReference } from "src/source_types";

/** Responsibilities: _source reference collection_, _symbol ownership resolution_, _usage presence lookup_. **/
export class UnusedSymbolReferenceIndex implements UnusedSymbolReferenceIndexContract, UnusedSymbolUsageStoreContract {
	private readonly _references: SourceReferenceIndexContract<string>;
	private readonly _symbols_by_file: UnusedSymbolUsageByFile;
	private readonly _fields_by_file: UnusedFieldUsageByFile;
	private readonly _import_index: UnusedSymbolImportIndexContract;
	private readonly _ownership: UnusedSymbolPropertyOwnershipContract;
	private readonly _parameter_shadow: UnusedSymbolParameterShadowContract;
	private readonly _property_usage_index: UnusedSymbolPropertyUsageIndexContract;
	private readonly _pending_references: PendingUnusedSymbolReference[];

	/** Responsibilities: _source usage indexing_. **/
	private add_source_reference(reference: PendingUnusedSymbolReference): void {
		const { source, name, line } = reference;
		if (this._parameter_shadow.parameter_shadow(source, name, line)) {
			return;
		}
		for (const definition of this._import_index.imported_definitions(reference)) {
			this.record_symbol_usage({ file: definition.file, name: definition.name });
		}
	}

	/** Responsibilities: _pending source reference finalization_. **/
	private finalize_references(): void {
		const pending = this._pending_references.splice(0);
		for (const reference of pending) {
			this.add_source_reference(reference);
		}
	}

	/** Responsibilities: _unused symbol index state_. **/
	public constructor(
		scanner: ProjectSourceScanContract,
		available_files: Set<string>,
		definitions_by_file: ReadonlyMap<string, readonly UnusedSymbolDefinition[]>,
	) {
		const import_cache: UnusedSourceImportCache = new Map<string, ReadonlySet<string>>();
		this._references = new SourceReferenceIndex<string>();
		this._symbols_by_file = new Map<string, Set<string>>();
		this._fields_by_file = new Map<string, UnusedFieldUsageByOwner>();
		this._import_index = new UnusedSymbolImportIndex(scanner, available_files, definitions_by_file, import_cache);
		const ownership = new UnusedSymbolOwnership(scanner, available_files, definitions_by_file, import_cache);
		this._ownership = ownership;
		this._parameter_shadow = ownership;
		this._property_usage_index = new UnusedSymbolPropertyUsageIndex(this, this._ownership);
		this._pending_references = [];
	}

	/** Responsibilities: _symbol usage presence insertion_. **/
	public record_symbol_usage(key: UnusedSymbolUsageKey): void {
		let names = this._symbols_by_file.get(key.file);
		if (names === undefined) {
			names = new Set<string>();
			this._symbols_by_file.set(key.file, names);
		}
		names.add(key.name);
	}

	/** Responsibilities: _symbol usage presence lookup_. **/
	public symbol_usage_present(key: UnusedSymbolUsageKey): boolean {
		const names = this._symbols_by_file.get(key.file);
		if (names === undefined) {
			return false;
		}
		return names.has(key.name);
	}

	/** Responsibilities: _field usage presence insertion_. **/
	public record_field_usage(key: UnusedFieldUsageKey): void {
		let owners = this._fields_by_file.get(key.owner.file);
		if (owners === undefined) {
			owners = new Map<string, Set<string>>();
			this._fields_by_file.set(key.owner.file, owners);
		}
		let names = owners.get(key.owner.owner);
		if (names === undefined) {
			names = new Set<string>();
			owners.set(key.owner.owner, names);
		}
		names.add(key.name);
	}

	/** Responsibilities: _field usage presence lookup_. **/
	public field_usage_present(key: UnusedFieldUsageKey): boolean {
		const owners = this._fields_by_file.get(key.owner.file);
		if (owners === undefined) {
			return false;
		}
		const names = owners.get(key.owner.owner);
		if (names === undefined) {
			return false;
		}
		return names.has(key.name);
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
		this.record_symbol_usage({ file, name });
	}

	/** Responsibilities: _source usage collection_. **/
	public add_source(source: LintSourceRecordData): void {
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
		if (this.symbol_usage_present({ file: definition.file, name: definition.name })) {
			return true;
		}
		if (definition.kind !== PUBLIC_FIELD_KIND) {
			return false;
		}
		return this._property_usage_index.usage_present(definition);
	}
}
