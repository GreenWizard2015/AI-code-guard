import type { CallableSourceIdentityGraphContract } from "src/analysis_protocols";
import type { ReadonlyStringSetMap } from "src/analysis_types";

/** Responsibilities: _concrete class descendant indexing_, _shared descendant lookup_. **/
export class CallableConcreteDescendantIndex {
	private readonly descendants: ReadonlyStringSetMap;

	/** Responsibilities: _descendant ownership lookup_. **/
	public constructor(descendants: ReadonlyStringSetMap) {
		this.descendants = descendants;
	}

	/** Responsibilities: _concrete descendant candidates lookup_. **/
	public candidates(right_ids: readonly string[]): readonly string[] {
		const result = new Set<string>();
		for (const right_id of right_ids) {
			const descendants = this.descendants.get(right_id);
			if (descendants === undefined) {
				continue;
			}
			for (const identity of descendants) {
				result.add(identity);
			}
		}
		return [...result];
	}

	/** Responsibilities: _shared descendant ownership_. **/
	public present(right_ids: readonly string[], left: string, identities: CallableSourceIdentityGraphContract): boolean {
		for (const identity of this.candidates(right_ids)) {
			const ancestors = identities.class_ancestors(identity);
			const ancestor_names = [...ancestors];
			if (ancestor_names.some((item) => item.endsWith(`::${left}`))) {
				return true;
			}
		}
		return false;
	}
}
