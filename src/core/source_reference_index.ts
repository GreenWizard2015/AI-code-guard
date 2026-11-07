import { IMPLEMENTATION_RELATION } from "src/constants";
import type { SourceReferenceIndexContract } from "src/shared_services_protocols";
import type { SourceReference, SourceReferenceMap, SourceReferenceRelation } from "src/source_types";

/** Responsibilities: _implementation reference indexing_, _usage reference indexing_. **/
export class SourceReferenceIndex<TKey extends {}> implements SourceReferenceIndexContract<TKey> {
	private readonly _implementations_by_key: SourceReferenceMap<TKey>;
	private readonly _usages_by_key: SourceReferenceMap<TKey>;
	private readonly _empty_references: readonly SourceReference[];

	/** Responsibilities: _source reference map insertion_. **/
	private add_reference(references_by_key: SourceReferenceMap<TKey>, key: TKey, reference: SourceReference): void {
		let references = references_by_key.get(key);
		if (references === undefined) {
			references = [];
			references_by_key.set(key, references);
		}
		references.push(reference);
	}

	/** Responsibilities: _source reference index initialization_. **/
	public constructor() {
		this._implementations_by_key = new Map<TKey, SourceReference[]>();
		this._usages_by_key = new Map<TKey, SourceReference[]>();
		this._empty_references = Object.freeze([]);
	}

	/** Responsibilities: _source implementation reference storage_. **/
	public add_implementation(implementation_key: TKey, implementation_reference: SourceReference): void {
		this.add_reference(this._implementations_by_key, implementation_key, implementation_reference);
	}

	/** Responsibilities: _source usage reference storage_. **/
	public add_usage(usage_key: TKey, usage_reference: SourceReference): void {
		this.add_reference(this._usages_by_key, usage_key, usage_reference);
	}

	/** Responsibilities: _source usage presence insertion_. **/
	public add_usage_once(usage_key: TKey, file: string, line: number): void {
		if (this._usages_by_key.get(usage_key) !== undefined) {
			return;
		}
		this._usages_by_key.set(usage_key, [{ file, line }]);
	}

	/** Responsibilities: _source reference lookup_. **/
	public references_for(key: TKey, relation: SourceReferenceRelation): readonly SourceReference[] {
		let references_by_key = this._usages_by_key;
		if (relation === IMPLEMENTATION_RELATION) {
			references_by_key = this._implementations_by_key;
		}
		const references = references_by_key.get(key);
		if (references === undefined) {
			return this._empty_references;
		}
		return references;
	}

	/** Responsibilities: _repeated source usage selection_. **/
	public repeated_usages(minimum_repetitions: number): readonly SourceReference[] {
		const repeated: SourceReference[] = [];
		const keys = new Set<TKey>();
		for (const key of this._implementations_by_key.keys()) {
			keys.add(key);
		}
		for (const key of this._usages_by_key.keys()) {
			keys.add(key);
		}
		for (const key of keys) {
			const references = this.references_for(key, "usage");
			if (references.length < minimum_repetitions) {
				continue;
			}
			repeated.push(...references);
		}
		return repeated;
	}
}
