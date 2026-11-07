import type { CallableReferencesByNameContract } from "src/metrics/types";
import type { AstCallableReference } from "src/model/ast/normalized_ast_types";

/** Responsibilities: _reference bucket storage_, _reference access accounting_. **/
export class CallableReferenceScanMap extends Map<string, readonly AstCallableReference[]> {
	private _measuring: boolean;
	private _unrelated_reference_accesses: number;
	private readonly _owner_lookup: CallableReferencesByNameContract;

	/** Responsibilities: _reference scan measurement state_. **/
	public constructor(references: CallableReferencesByNameContract) {
		super(references);
		this._measuring = false;
		this._unrelated_reference_accesses = 0;
		this._owner_lookup = references;
	}

	/** Responsibilities: _owned reference lookup_. **/
	public owned_references(kind: "function" | "method", name: string): readonly AstCallableReference[] {
		return this._owner_lookup.owned_references(kind, name);
	}

	/** Responsibilities: _reference bucket access measurement_. **/
	public override *values(): MapIterator<readonly AstCallableReference[]> {
		for (const references of super.values()) {
			if (this._measuring) {
				for (const reference of references) {
					if (reference.name !== "target") {
						this._unrelated_reference_accesses += 1;
					}
				}
			}
			yield references;
		}
	}

	/** Responsibilities: _reference scan measurement_. **/
	public measure(): void {
		this._measuring = true;
	}

	/** Responsibilities: _unrelated reference accesses_. **/
	public unrelated_reference_visits(): number {
		return this._unrelated_reference_accesses;
	}
}
