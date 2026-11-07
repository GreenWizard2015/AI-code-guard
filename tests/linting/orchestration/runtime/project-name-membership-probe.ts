import type { ProjectNameMembershipContract } from "src/source_protocols";

/** Responsibilities: _project-name membership observation_, _shared query recording_. **/
export class ProjectNameMembershipProbe implements ProjectNameMembershipContract {
	private readonly _names: ProjectNameMembershipContract;
	private readonly _queries: string[];

	/** Responsibilities: _project-name observation setup_. **/
	public constructor(names: ProjectNameMembershipContract, queries: string[]) {
		this._names = names;
		this._queries = queries;
	}

	/** Responsibilities: _project-name membership lookup_. **/
	public has(name: string): boolean {
		this._queries.push(name);
		return this._names.contains(name);
	}

	/** Responsibilities: _project-name contract lookup_. **/
	public contains(name: string): boolean {
		return this._names.contains(name);
	}
}
