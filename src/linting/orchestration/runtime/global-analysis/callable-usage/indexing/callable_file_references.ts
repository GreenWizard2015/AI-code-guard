import type { CallableReferencesByNameContract, OwnedReferencesByKind, SharedCallableKind } from "src/metrics/types";
import type { AstCallableReference } from "src/model/ast/normalized_ast_types";

/** Responsibilities: _named callable references_, _owned callable references_. **/
export class CallableFileReferences
	extends Map<string, AstCallableReference[]>
	implements CallableReferencesByNameContract
{
	private readonly _owned: OwnedReferencesByKind;
	private readonly _empty: readonly AstCallableReference[];

	/** Responsibilities: _file reference index initialization_. **/
	public constructor() {
		super();
		this._owned = new Map();
		this._empty = Object.freeze([]);
	}

	/** Responsibilities: _reference bucket insertion_. **/
	public append(reference: AstCallableReference): void {
		let key = `${reference.kind}::${reference.name}`;
		if (reference.target_file.length > 0) {
			key = `${reference.kind}:${reference.target_file}:${reference.name}`;
		}
		let named = this.get(key);
		if (named === undefined) {
			named = [];
			this.set(key, named);
		}
		named.push(reference);
	}

	/** Responsibilities: _owner bucket construction_. **/
	public finish(): void {
		for (const references of this.values()) {
			for (const reference of references) {
				this.append_owned(reference);
			}
		}
	}

	/** Responsibilities: _owned reference insertion_. **/
	private append_owned(reference: AstCallableReference): void {
		if (reference.owner.length === 0) {
			return;
		}
		let names = this._owned.get(reference.kind);
		if (names === undefined) {
			names = new Map();
			this._owned.set(reference.kind, names);
		}
		let owned = names.get(reference.name);
		if (owned === undefined) {
			owned = [];
			names.set(reference.name, owned);
		}
		owned.push(reference);
	}

	/** Responsibilities: _owned reference lookup_. **/
	public owned_references(kind: SharedCallableKind, name: string): readonly AstCallableReference[] {
		const names = this._owned.get(kind);
		if (names === undefined) {
			return this._empty;
		}
		return names.get(name) ?? this._empty;
	}
}
