import type { ProjectSourceScopeOptions } from "src/core/types";
import type { IOContract } from "src/io/protocols";
import type {
	DirectoryFileSet,
	ProjectRuleSnapshots,
	ProjectSourceAnalysisOptionsContract,
} from "src/project_analysis_types";
import type { CallableOperation } from "src/runtime_types";
import type { LintProjectContextContract } from "src/shared_services_protocols";
import type { ProjectSourceScanContract } from "src/source_protocols";

/** Responsibilities: _project source analysis_, _snapshot lifecycle_. **/
export class LintRunProjectSourceScope implements ProjectSourceAnalysisOptionsContract {
	private readonly _capture_states: Set<boolean>;
	private readonly _options: ProjectSourceScopeOptions;

	/** Responsibilities: _project source scope setup_. **/
	public constructor(options: ProjectSourceScopeOptions) {
		this._capture_states = new Set();
		this._options = options;
	}

	/** Responsibilities: _project analysis inputs_. **/
	public project_analysis(): ProjectSourceAnalysisOptionsContract {
		return this;
	}

	/** Responsibilities: _project root path_. **/
	public root(): string {
		return this._options.root;
	}

	/** Responsibilities: _project source paths_. **/
	public project_files(): readonly string[] {
		return this._options.project_files;
	}

	/** Responsibilities: _project source records_. **/
	public context(): LintProjectContextContract {
		return this._options.context;
	}

	/** Responsibilities: _ignored project paths_. **/
	public ignored_files(): ReadonlySet<string> {
		return this._options.ignored_files;
	}

	/** Responsibilities: _project source scanning_. **/
	public scanner(): ProjectSourceScanContract {
		return this._options.scanner;
	}

	/** Responsibilities: _project file reading_. **/
	public file_io(): IOContract {
		return this._options.file_io;
	}

	/** Responsibilities: _project directory files_. **/
	public directory_files(): DirectoryFileSet {
		return this._options.directory_files;
	}

	/** Responsibilities: _project rule snapshots_. **/
	public project_rule_snapshots(): ProjectRuleSnapshots {
		return this._options.project_rule_snapshots;
	}

	/** Responsibilities: _snapshot status_. **/
	public snapshot_capture_active(): boolean {
		return this._capture_states.has(true);
	}

	/** Responsibilities: _snapshot lifecycle_. **/
	public capture_snapshots_during<Result>(operation: CallableOperation<Result>): Result {
		const was_active = this.snapshot_capture_active();
		this._capture_states.add(true);
		try {
			return operation();
		} finally {
			this._capture_states.clear();
			if (was_active) {
				this._capture_states.add(true);
			}
		}
	}
}
