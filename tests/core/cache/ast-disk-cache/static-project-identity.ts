import type { ProjectAnalysisIdentityContract } from "src/runtime_protocols";
import type { LintSourceRecordData } from "src/source_types";

/** Responsibilities: _cache analyzer identity_, _cache project scope identity_. **/
export class StaticProjectIdentity implements ProjectAnalysisIdentityContract {
	private readonly _analyzer_value: string;

	/** Responsibilities: _test analyzer identity selection_. **/
	public constructor(analyzer_value = "analyzer-v1") {
		this._analyzer_value = analyzer_value;
	}

	/** Responsibilities: _stable analyzer identity_. **/
	public analyzer(): string {
		return this._analyzer_value;
	}

	/** Responsibilities: _content identity_. **/
	public content(value: string): string {
		return value;
	}

	/** Responsibilities: _project context identity_. **/
	public context(records: readonly LintSourceRecordData[]): string {
		return String(records.length);
	}

	/** Responsibilities: _directory identity_. **/
	public directory_context(root: string): string {
		return root;
	}

	/** Responsibilities: _selection identity_. **/
	public selection(
		files: ReadonlySet<string>,
		ignored_files: ReadonlySet<string>,
		entry_files: ReadonlySet<string>,
	): string {
		return `${files.size}:${ignored_files.size}:${entry_files.size}`;
	}
}
