import type { ProjectTypeNameMembershipContract } from "src/metrics/types";

/** Responsibilities: _project names_, _base names_. **/
export class ProjectBoundaryProjectTypes implements ProjectTypeNameMembershipContract {
	private readonly _base_types: ReadonlySet<string>;
	private readonly _imported_types: ReadonlySet<string>;

	/** Responsibilities: _project boundary membership initialization_. **/
	public constructor(base_types: ReadonlySet<string>, imported_types: ReadonlySet<string>) {
		this._base_types = base_types;
		this._imported_types = imported_types;
	}

	/** Responsibilities: _project boundary class lookup_. **/
	public contains(name: string): boolean {
		return this._base_types.has(name) && !this._imported_types.has(name);
	}

	/** Responsibilities: _project type count_. **/
	public count(): number {
		let imported_base_count = 0;
		for (const name of this._imported_types) {
			if (this._base_types.has(name)) {
				imported_base_count += 1;
			}
		}
		return this._base_types.size - imported_base_count;
	}
}
