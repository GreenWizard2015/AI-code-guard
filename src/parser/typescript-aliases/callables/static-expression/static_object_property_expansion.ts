import type { StaticObjectPropertyExpansionContract } from "src/typescript_analysis_protocols";
import type ts from "typescript";

/** Responsibilities: _object property expansion state_, _branch result composition_. **/
export class StaticObjectPropertyExpansion implements StaticObjectPropertyExpansionContract {
	private readonly _is_found: boolean;
	private readonly _expanded_properties: readonly ts.ObjectLiteralElementLike[];

	/** Responsibilities: _object expansion state initialization_. **/
	public constructor(found: boolean, properties: readonly ts.ObjectLiteralElementLike[]) {
		this._is_found = found;
		this._expanded_properties = properties;
	}

	/** Responsibilities: _object expansion discovery state_. **/
	public found(): boolean {
		return this._is_found;
	}

	/** Responsibilities: _expanded object properties_. **/
	public properties(): readonly ts.ObjectLiteralElementLike[] {
		return this._expanded_properties;
	}

	/** Responsibilities: _expanded property transfer_. **/
	public append_to(target: ts.ObjectLiteralElementLike[]): void {
		target.push(...this._expanded_properties);
	}

	/** Responsibilities: _branch expansion composition_. **/
	public merge(other: StaticObjectPropertyExpansionContract): StaticObjectPropertyExpansionContract {
		return new StaticObjectPropertyExpansion(this._is_found || other.found(), [
			...this._expanded_properties,
			...other.properties(),
		]);
	}
}
