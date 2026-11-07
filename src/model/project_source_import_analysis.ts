import type { UnresolvedSpecifierInput } from "src/model_types";
import type { ProjectSourceImportAnalysisContract, ProjectSourceImportCacheContract } from "src/source_protocols";

/** Responsibilities: _import target indexing_, _specifier indexing_. **/
export class ProjectSourceImportAnalysis implements ProjectSourceImportAnalysisContract {
	private readonly _resolved: Set<string>;
	private readonly _unresolved: string[];

	/** Responsibilities: _empty project import analysis_. **/
	public constructor() {
		this._resolved = new Set<string>();
		this._unresolved = [];
	}

	/** Responsibilities: _target indexing_. **/
	public add_resolved(target: string): void {
		if (target.length > 0) {
			this._resolved.add(target);
		}
	}

	/** Responsibilities: _unresolved import specifier recording_. **/
	public add_unresolved(specifier: string): void {
		this._unresolved.push(specifier);
	}

	/** Responsibilities: _import resolution recording_. **/
	public append(input: UnresolvedSpecifierInput, cache: ProjectSourceImportCacheContract): void {
		const imported = cache.resolve(input);
		if (imported.length > 0) {
			this.add_resolved(imported);
		} else if (cache.should_check(input)) {
			this.add_unresolved(input.specifier);
		}
	}

	/** Responsibilities: _target index access_. **/
	public resolved_targets(): ReadonlySet<string> {
		return this._resolved;
	}

	/** Responsibilities: _unresolved import exposure_. **/
	public unresolved_specifiers(): readonly string[] {
		return this._unresolved;
	}
}
