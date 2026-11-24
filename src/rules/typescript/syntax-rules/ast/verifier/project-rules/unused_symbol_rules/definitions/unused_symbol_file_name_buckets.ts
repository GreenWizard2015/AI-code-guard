import type { UnusedSymbolFileNameBucketsContract } from "src/contracts/protocols/global_analysis_protocols";
import type { UnusedDefinitionMatches, UnusedSymbolDefinition, UnusedSymbolNameBuckets } from "src/core/types";

/** Responsibilities: _per-file name index_, _definition grouping_. **/
export class UnusedSymbolFileNameBuckets implements UnusedSymbolFileNameBucketsContract {
	private readonly _definitions_by_name: UnusedSymbolNameBuckets;

	/** Responsibilities: _per-file index initialization_. **/
	public constructor() {
		this._definitions_by_name = new Map<string, UnusedSymbolDefinition[]>();
	}

	/** Responsibilities: _definition registration_. **/
	public add(definition: UnusedSymbolDefinition): void {
		let matching = this._definitions_by_name.get(definition.name);
		if (matching === undefined) {
			matching = [];
			this._definitions_by_name.set(definition.name, matching);
		}
		matching.push(definition);
	}

	/** Responsibilities: _all file definitions_. **/
	public all(): UnusedDefinitionMatches {
		const definition_groups = [...this._definitions_by_name.values()];
		return definition_groups.flat();
	}

	/** Responsibilities: _named definition matching_. **/
	public named(names: readonly string[]): UnusedDefinitionMatches {
		const matches: UnusedSymbolDefinition[] = [];
		for (const name of names) {
			const named = this._definitions_by_name.get(name);
			if (named !== undefined) {
				matches.push(...named);
			}
		}
		return matches;
	}

	/** Responsibilities: _exact definition lookup_. **/
	public exact(name: string): UnusedDefinitionMatches {
		return this._definitions_by_name.get(name) ?? [];
	}
}
