import type {
	UnusedFieldOwner,
	UnusedFieldOwnerIndex,
	UnusedFieldOwnerRecord,
	UnusedSymbolDefinition,
	UnusedTypeFieldIndex,
} from "src/core/types";
import { PUBLIC_FIELD_KIND } from "src/constants";

/** Responsibilities: _unused field indexing_, _field owner resolution_. **/
export class UnusedFieldOwnershipIndex {
	private readonly definitions_by_file: ReadonlyMap<string, readonly UnusedSymbolDefinition[]>;
	private readonly owners: UnusedFieldOwnerIndex;
	private readonly type_fields: UnusedTypeFieldIndex;
	private readonly prepared_files: Set<string>;

	/** Responsibilities: _type field index entry_. **/
	private append_type_field(definition: UnusedSymbolDefinition): void {
		let fields = this.type_fields.get(definition.name);
		if (fields === undefined) {
			fields = [];
			this.type_fields.set(definition.name, fields);
		}
		fields.push({ file: definition.file, owner: definition.owner });
	}

	/** Responsibilities: _owner field index entry_. **/
	private append_owner_field(source_file: string, definition: UnusedSymbolDefinition, seen: Set<string>): void {
		if (seen.has(definition.owner)) {
			return;
		}
		const current = this.owners.get(definition.owner);
		if (current === undefined) {
			this.owners.set(definition.owner, []);
		}
		const fields = this.owners.get(definition.owner);
		if (fields === undefined) {
			return;
		}
		seen.add(definition.owner);
		fields.push({ file: definition.file, owner: definition.owner, source_file });
	}

	/** Responsibilities: _field definition indexing_. **/
	private append_definition(source_file: string, definition: UnusedSymbolDefinition, seen: Set<string>): void {
		if (definition.kind !== PUBLIC_FIELD_KIND) {
			return;
		}
		if (definition.owner_kind === "type") {
			this.append_type_field(definition);
		}
		this.append_owner_field(source_file, definition, seen);
	}

	/** Responsibilities: _file field indexing_. **/
	private append_file(source_file: string, definitions: readonly UnusedSymbolDefinition[]): void {
		const seen = new Set<string>();
		for (const definition of definitions) {
			this.append_definition(source_file, definition, seen);
		}
	}

	/** Responsibilities: _field ownership index preparation_. **/
	private ensure_prepared(): void {
		if (this.prepared_files.size === this.definitions_by_file.size) {
			return;
		}
		for (const [source_file, definitions] of this.definitions_by_file) {
			if (this.prepared_files.has(source_file)) {
				continue;
			}
			this.append_file(source_file, definitions);
			this.prepared_files.add(source_file);
		}
	}

	/** Responsibilities: _field ownership index initialization_. **/
	public constructor(definitions_by_file: ReadonlyMap<string, readonly UnusedSymbolDefinition[]>) {
		this.definitions_by_file = definitions_by_file;
		this.owners = new Map<string, UnusedFieldOwnerRecord[]>();
		this.type_fields = new Map<string, UnusedFieldOwner[]>();
		this.prepared_files = new Set<string>();
	}

	/** Responsibilities: _owner field selection_. **/
	public owner_fields(
		source_file: string,
		owner: string,
		imported_files: ReadonlySet<string>,
	): readonly UnusedFieldOwner[] {
		this.ensure_prepared();
		const fields = this.owners.get(owner);
		if (fields === undefined) {
			return [];
		}
		const result: UnusedFieldOwner[] = [];
		for (const field of fields) {
			if (field.source_file !== source_file) {
				if (!imported_files.has(field.source_file)) {
					continue;
				}
			}
			result.push({ file: field.file, owner: field.owner });
		}
		return result;
	}

	/** Responsibilities: _type field selection_. **/
	public fields_named(name: string): readonly UnusedFieldOwner[] {
		this.ensure_prepared();
		const fields = this.type_fields.get(name);
		if (fields === undefined) {
			return [];
		}
		return fields;
	}
}
