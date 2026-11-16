import { relative, resolve } from "node:path";
import type { AgentPackageHistoryContract, AgentPackagePreviousAssignment } from "src/task_selection_types";

/** Responsibilities: _previous file ownership_, _folder scope matching_. **/
export class AgentPackageHistory implements AgentPackageHistoryContract {
	private readonly _root: string;
	private readonly _assignments: readonly AgentPackagePreviousAssignment[];

	/** Responsibilities: _best folder owner_. **/
	private best_scope_number(candidate_path: string): number {
		let best_scope_length = 0;
		let best_package_number = 0;
		for (const assignment of this._assignments) {
			for (const scope of assignment.path_scopes) {
				const scope_depth = scope.split("/").filter((segment) => segment.length > 0).length;
				const matches_path = scope.endsWith("/") && scope_depth > 1 && candidate_path.startsWith(scope);
				const longer_scope = scope.length > best_scope_length;
				const earlier_owner = assignment.package_number < best_package_number;
				const preferred_scope = longer_scope || (scope.length === best_scope_length && earlier_owner);
				if (matches_path && preferred_scope) {
					best_scope_length = scope.length;
					best_package_number = assignment.package_number;
				}
			}
		}
		return best_package_number;
	}

	/** Responsibilities: _previous ownership initialization_. **/
	public constructor(root: string, assignments: readonly AgentPackagePreviousAssignment[]) {
		this._root = resolve(root);
		this._assignments = assignments;
	}

	/** Responsibilities: _workspace path normalization_. **/
	public normalized_path(path: string): string {
		return relative(this._root, resolve(this._root, path)).replaceAll("\\", "/");
	}

	/** Responsibilities: _previous file lookup_. **/
	public owner_for_file(source_file: string): number {
		const path = this.normalized_path(source_file);
		for (const assignment of this._assignments) {
			if (assignment.files.includes(path)) {
				return assignment.package_number;
			}
		}
		return this.best_scope_number(path);
	}
}
