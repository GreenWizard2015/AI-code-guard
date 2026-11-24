import type { ViolationContract } from "src/reporting_protocols";

/** Responsibilities: _main-thread file results_, _main-thread root diagnostics_. **/
export class MainWorkerResults {
	private readonly _results: ReadonlyMap<string, readonly ViolationContract[]>;

	/** Responsibilities: _main-thread root diagnostic identity_. **/
	private identity(violation: ViolationContract): string {
		return JSON.stringify([
			violation.file(),
			violation.line(),
			violation.message(),
			violation.hint(),
			violation.rule_id(),
			violation.priority(),
		]);
	}

	/** Responsibilities: _main-thread result ownership_. **/
	public constructor(results: ReadonlyMap<string, readonly ViolationContract[]>) {
		this._results = results;
	}

	/** Responsibilities: _main-thread file diagnostic copies_. **/
	public files(): Map<string, ViolationContract[]> {
		const entries = [...this._results];
		return new Map(entries.map(([file, violations]) => [file, [...violations]]));
	}

	/** Responsibilities: _main-thread root diagnostic collection_. **/
	public root_diagnostics(): Map<string, ViolationContract> {
		const root_violations = new Map<string, ViolationContract>();
		const root_results = this._results.get("");
		if (root_results === undefined) {
			return root_violations;
		}
		for (const violation of root_results) {
			root_violations.set(this.identity(violation), violation);
		}
		return root_violations;
	}
}
