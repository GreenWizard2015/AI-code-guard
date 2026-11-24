import { ProjectSourceScanner } from "src/core/project-source/project_source_scanner";
import type {
	DirectoryFileSet,
	ProjectRuleSnapshots,
	ProjectSourceAnalysisOptionsContract,
} from "src/project_analysis_types";
import type { CallableOperation } from "src/runtime_types";
import type { LintProjectContextContract } from "src/shared_services_protocols";
import { InMemoryFileIO } from "tests/bridge/ts/core/cache/in_memory_file_io";

/** Responsibilities: _project scope_, _snapshot lifecycle_. **/
export class ProjectSourceAnalysisOptionsFixture implements ProjectSourceAnalysisOptionsContract {
	private readonly _root: string;
	private readonly _project_files: readonly string[];
	private readonly _context: LintProjectContextContract;
	private readonly _ignored_files: ReadonlySet<string>;
	private readonly _scanner: ProjectSourceScanner;
	private readonly _file_io: InMemoryFileIO;
	private readonly _directory_files: DirectoryFileSet;
	private readonly _project_rule_snapshots: ProjectRuleSnapshots;
	private _capture_snapshots = false;

	/** Responsibilities: _project source analysis options_. **/
	public constructor(
		root: string,
		project_files: readonly string[],
		context: LintProjectContextContract,
		ignored_files: ReadonlySet<string>,
		directory_files_override: DirectoryFileSet,
	) {
		const scanner = new ProjectSourceScanner(root, {
			context_state: { available: true, value: context },
			entry_files: [],
		});
		const project_rule_snapshots: ProjectRuleSnapshots = [];
		const file_io = new InMemoryFileIO();
		const directory_files = directory_files_override;
		this._root = root;
		this._project_files = project_files;
		this._context = context;
		this._ignored_files = ignored_files;
		this._scanner = scanner;
		this._file_io = file_io;
		this._directory_files = directory_files;
		this._project_rule_snapshots = project_rule_snapshots;
	}

	/** Responsibilities: _project source analysis options_. **/
	public options(): ProjectSourceAnalysisOptionsContract {
		return this;
	}

	/** Responsibilities: _project root access_. **/
	public root(): string {
		return this._root;
	}

	/** Responsibilities: _project file access_. **/
	public project_files(): readonly string[] {
		return this._project_files;
	}

	/** Responsibilities: _project context access_. **/
	public context(): LintProjectContextContract {
		return this._context;
	}

	/** Responsibilities: _ignored path access_. **/
	public ignored_files(): ReadonlySet<string> {
		return this._ignored_files;
	}

	/** Responsibilities: _project scanner access_. **/
	public scanner(): ProjectSourceScanner {
		return this._scanner;
	}

	/** Responsibilities: _project file I/O access_. **/
	public file_io(): InMemoryFileIO {
		return this._file_io;
	}

	/** Responsibilities: _directory file scope_. **/
	public directory_files(): DirectoryFileSet {
		return this._directory_files;
	}

	/** Responsibilities: _project rule snapshots_. **/
	public project_rule_snapshots(): ProjectRuleSnapshots {
		return this._project_rule_snapshots;
	}

	/** Responsibilities: _snapshot status_. **/
	public snapshot_capture_active(): boolean {
		return this._capture_snapshots;
	}

	/** Responsibilities: _snapshot state management_. **/
	public capture_snapshots_during<Result>(operation: CallableOperation<Result>): Result {
		const previous = this._capture_snapshots;
		this._capture_snapshots = true;
		try {
			return operation();
		} finally {
			this._capture_snapshots = previous;
		}
	}
}
