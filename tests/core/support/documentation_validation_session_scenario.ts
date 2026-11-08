import { AstModel } from "src/core/ast_model";
import { LintFileName } from "src/core/context/lint_file_name";
import type { DocumentationExampleLintConfigurationContract } from "src/core/support/protocols";
import { LintReportMode } from "src/core/types";
import type { LintReportOptions } from "src/core/types";
import { InMemoryProjectSourceIO } from "src/io/in_memory_project_source_io";
import { TypeScriptAstFile } from "src/model/ast/type_script_ast_file";
import { ViolationValue } from "src/model/violation_value";
import { TypeScriptAstTraversal } from "src/parser/analysis/type_script_ast_traversal";
import type { WorkerSessionLeaseContract } from "src/runtime_protocols";
import type { LintExecutionReport } from "src/runtime_types";
import type { LintProjectContextContract } from "src/shared_services_protocols";
import type { LintSourceRecordData } from "src/source_types";

/** Responsibilities: _documentation example lint scenario_, _project context fixture_, _worker session observation_. **/
export class DocumentationValidationSessionScenario
	implements DocumentationExampleLintConfigurationContract, LintProjectContextContract, WorkerSessionLeaseContract
{
	private readonly _repo_root = "/virtual/documentation-example";
	private readonly _violation: ViolationValue;
	private _file_requests = 0;
	private _lint_mode: LintReportMode;
	private _project_analysis_enabled = false;
	private _source_io_requests = 0;
	private _source_record_requests = 0;
	private _worker_session_requests = 0;
	private _worker_session_active = false;

	/** Responsibilities: _scenario source record_. **/
	private create_source_record(file: string): LintSourceRecordData {
		const ast_file = new TypeScriptAstFile(file, "");
		const python_ast_model = new AstModel("python");
		return {
			absolute_path: `${this._repo_root}/${file}`,
			relative_path: file,
			file_name: new LintFileName(file),
			text: "pass\n",
			normalized_ast: python_ast_model.empty_ast_file(),
			language: "python",
			typescript_ast: ast_file,
			source_resolver: new Map(),
			traversal: new TypeScriptAstTraversal(ast_file.source_file_node()),
		};
	}

	/** Responsibilities: _scenario initialization_. **/
	public constructor() {
		this._lint_mode = LintReportMode.PROJECT;
		this._violation = new ViolationValue({
			file: "cli.py",
			line: 1,
			message: "Python source is unused",
			hint: "Use it or remove it.",
			rule_id: "unused-file",
			priority: 7,
		});
	}

	/** Responsibilities: _documentation lint report_. **/
	public lint_report(options: LintReportOptions, mode: LintReportMode): LintExecutionReport {
		this._lint_mode = mode;
		this._project_analysis_enabled = options.project_analysis_enabled;
		return {
			context: this,
			report: { files: [`${this._repo_root}/cli.py`], violations: [this._violation] },
		};
	}

	/** Responsibilities: _source record lookup_. **/
	public source_record(file: string): LintSourceRecordData {
		this._source_record_requests += 1;
		return this.create_source_record(file);
	}

	/** Responsibilities: _project source records_. **/
	public files(): readonly LintSourceRecordData[] {
		this._file_requests += 1;
		return [this.create_source_record("cli.py")];
	}

	/** Responsibilities: _project analysis counts_. **/
	public statistics(): {
		source_reads: number;
		typescript_parses: number;
		python_parses: number;
		source_records: number;
	} {
		return { source_reads: 0, typescript_parses: 0, python_parses: 0, source_records: 0 };
	}

	/** Responsibilities: _project source IO_. **/
	public source_io(): InMemoryProjectSourceIO {
		this._source_io_requests += 1;
		return new InMemoryProjectSourceIO(new Map());
	}

	/** Responsibilities: _active worker session observation_. **/
	public active_worker_session(): WorkerSessionLeaseContract {
		this._worker_session_requests += 1;
		return this;
	}

	/** Responsibilities: _worker lease status_. **/
	public active(): boolean {
		return this._worker_session_active;
	}

	/** Responsibilities: _worker lease closure_. **/
	public close(): Promise<void> {
		this._worker_session_active = false;
		return Promise.resolve();
	}

	/** Responsibilities: _scenario repository root_. **/
	public repo_root(): string {
		return this._repo_root;
	}

	/** Responsibilities: _expected scenario violation_. **/
	public expected_violation(): ViolationValue {
		return this._violation;
	}

	/** Responsibilities: _project context usage counts_. **/
	public context_counts(): { source_record: number; files: number; source_io: number } {
		return {
			source_record: this._source_record_requests,
			files: this._file_requests,
			source_io: this._source_io_requests,
		};
	}

	/** Responsibilities: _lint configuration observation_. **/
	public lint_state(): { lint_mode: LintReportMode; project_analysis_enabled: boolean } {
		return {
			lint_mode: this._lint_mode,
			project_analysis_enabled: this._project_analysis_enabled,
		};
	}

	/** Responsibilities: _worker acquisition state_. **/
	public worker_session_was_not_requested(): boolean {
		return this._worker_session_requests === 0;
	}

	/** Responsibilities: _worker provider cleanup_. **/
	public close_worker_session(): Promise<void> {
		return Promise.resolve();
	}
}
