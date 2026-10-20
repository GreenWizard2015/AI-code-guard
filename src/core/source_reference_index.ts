import type { SourceReferenceIndexContract } from "src/shared_services_protocols";
import type { SourceReference, SourceReferenceMap, SourceReferenceRelation } from "src/types";
import { IMPLEMENTATION_RELATION } from "src/constants";

/** Responsibilities: _implementation reference indexing_, _usage reference indexing_. **/
export class SourceReferenceIndex<TKey extends {}> implements SourceReferenceIndexContract<TKey> {
	private readonly implementations_by_key: SourceReferenceMap<TKey>;
	private readonly usages_by_key: SourceReferenceMap<TKey>;

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
		this.implementations_by_key = new Map<TKey, SourceReference[]>();
		this.usages_by_key = new Map<TKey, SourceReference[]>();
	}

	/** Responsibilities: _source implementation reference storage_. **/
	public add_implementation(key: TKey, reference: SourceReference): void {
		this.add_reference(this.implementations_by_key, key, reference);
	}

	/** Responsibilities: _source usage reference storage_. **/
	public add_usage(key: TKey, reference: SourceReference): void {
		this.add_reference(this.usages_by_key, key, reference);
	}

	/** Responsibilities: _source reference lookup_. **/
	public references_for(key: TKey, relation: SourceReferenceRelation): readonly SourceReference[] {
		let references_by_key = this.usages_by_key;
		if (relation === IMPLEMENTATION_RELATION) {
			references_by_key = this.implementations_by_key;
		}
		const references = references_by_key.get(key);
		if (references === undefined) {
			return [];
		}
		return references;
	}

	/** Responsibilities: _repeated source usage selection_. **/
	public repeated_usages(minimum_repetitions: number): readonly SourceReference[] {
		const repeated: SourceReference[] = [];
		const keys = new Set<TKey>([...this.implementations_by_key.keys(), ...this.usages_by_key.keys()]);
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
