import type { StringNameMembershipContract } from "src/metrics/types";

/** Responsibilities: _boundary type filtering_, _base and import membership_. **/
export class ProjectBoundaryTypeMembership implements StringNameMembershipContract {
	private readonly _base_types: ReadonlySet<string>;
	private readonly _class_types: ReadonlySet<string>;
	private readonly _excluded_types: ReadonlySet<string>;
	private readonly _imported_types: ReadonlySet<string>;
	private readonly _exclude_classes: boolean;

	/** Responsibilities: _project boundary membership initialization_. **/
	public constructor(
		base_types: ReadonlySet<string>,
		excluded_types: ReadonlySet<string>,
		imported_types: ReadonlySet<string>,
		class_types: ReadonlySet<string>,
		exclude_classes: boolean,
	) {
		this._base_types = base_types;
		this._class_types = class_types;
		this._excluded_types = excluded_types;
		this._imported_types = imported_types;
		this._exclude_classes = exclude_classes;
	}

	/** Responsibilities: _project boundary type lookup_. **/
	public present(name: string): boolean {
		if (this._exclude_classes && this._class_types.has(name)) {
			return false;
		}
		if (this._excluded_types.has(name)) {
			return false;
		}
		return this._base_types.has(name) || this._imported_types.has(name);
	}
}
