import type { StringNameMembershipContract } from "src/metrics/types";

/** Responsibilities: _boundary type filtering_, _base and import membership_. **/
export class ProjectBoundaryTypeMembership implements StringNameMembershipContract {
	private readonly base_types: ReadonlySet<string>;
	private readonly class_types: ReadonlySet<string>;
	private readonly excluded_types: ReadonlySet<string>;
	private readonly imported_types: ReadonlySet<string>;
	private readonly exclude_classes: boolean;

	/** Responsibilities: _project boundary membership initialization_. **/
	public constructor(
		base_types: ReadonlySet<string>,
		excluded_types: ReadonlySet<string>,
		imported_types: ReadonlySet<string>,
		class_types: ReadonlySet<string>,
		exclude_classes: boolean,
	) {
		this.base_types = base_types;
		this.class_types = class_types;
		this.excluded_types = excluded_types;
		this.imported_types = imported_types;
		this.exclude_classes = exclude_classes;
	}

	/** Responsibilities: _project boundary type lookup_. **/
	public present(name: string): boolean {
		if (this.exclude_classes && this.class_types.has(name)) {
			return false;
		}
		if (this.excluded_types.has(name)) {
			return false;
		}
		return this.base_types.has(name) || this.imported_types.has(name);
	}
}
