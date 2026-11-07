import type { ProjectNames } from "src/project_analysis_types";
import type { ProjectBoundaryNameSets, ProjectBoundaryNamesByProject } from "src/rules/typescript/syntax-rules/types";

/** Responsibilities: _project boundary-name derivation_, _project-name cache ownership_. **/
export class TypeScriptProjectBoundaryNameSets {
	private readonly _cache: ProjectBoundaryNamesByProject;

	/** Responsibilities: _name cache_. **/
	public constructor() {
		this._cache = new WeakMap();
	}

	/** Responsibilities: _allowed contract names_. **/
	public allowed_contracts(
		interface_names: ReadonlySet<string>,
		contract_names: ReadonlySet<string>,
		alias_names: ReadonlySet<string>,
	): ReadonlySet<string> {
		return new Set([...interface_names, ...contract_names, ...alias_names]);
	}

	/** Responsibilities: _project class names_. **/
	public project_class_names(
		class_names: ReadonlySet<string>,
		allowed_contracts: ReadonlySet<string>,
	): ReadonlySet<string> {
		const project_class_names = new Set<string>();
		for (const name of class_names) {
			if (!allowed_contracts.has(name)) {
				project_class_names.add(name);
			}
		}
		return project_class_names;
	}

	/** Responsibilities: _project boundary names_. **/
	public names(project_names: ProjectNames): ProjectBoundaryNameSets {
		const cached = this._cache.get(project_names);
		if (cached !== undefined) {
			return cached;
		}
		const allowed_contracts = this.allowed_contracts(
			project_names.project_interface_names,
			project_names.project_contract_names,
			project_names.typescript_alias_names,
		);
		const project_class_names = this.project_class_names(project_names.typescript_class_names, allowed_contracts);
		const names: ProjectBoundaryNameSets = {
			project_class_names,
			allowed_contracts,
			forbidden_project_types: project_class_names,
		};
		this._cache.set(project_names, names);
		return names;
	}
}
