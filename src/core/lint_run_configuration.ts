import { LintRunConfigurationAssembly } from "src/core/lint_run_configuration_assembly";
import { LintRunStateContext } from "src/core/lint_run_state_context";
import type {
	LintReportMode,
	LintReportOptions,
	LintRunConfigurationAssemblyContract,
	LintRunConfigurationAssemblyResult,
	LintRunConfigurationDependencies,
} from "src/core/types";
import type { IOContract } from "src/io/protocols";
import type { LintAnalysisStage, LintInputFiles } from "src/project_analysis_types";
import type { PythonAstWorkerSessionContract } from "src/python_protocols";
import type { LintRunRuntimeContract, LintRunWorkerLifecycleContract } from "src/runtime_protocols";
import type { LintExecutionReport } from "src/runtime_types";
import type { ProjectSourceIOContract } from "src/source_protocols";

/** Responsibilities: _lint input discovery_, _project analysis assembly_. **/
export class LintRunConfiguration implements LintRunRuntimeContract {
	private readonly _dependencies: LintRunConfigurationDependencies;
	private readonly _worker_lifecycle: LintRunWorkerLifecycleContract;

	/** Responsibilities: _lint configuration dependency initialization_. **/
	public constructor(project_source_io: ProjectSourceIOContract, project_file_io: IOContract) {
		const assembly: LintRunConfigurationAssemblyContract = new LintRunConfigurationAssembly(
			project_source_io,
			project_file_io,
		);
		const assembled: LintRunConfigurationAssemblyResult = assembly.assemble();
		this._dependencies = assembled.dependencies;
		this._worker_lifecycle = assembled.worker_lifecycle;
	}

	/** Responsibilities: _active Python worker session_. **/
	public active_worker_session(): PythonAstWorkerSessionContract {
		this._worker_lifecycle.ensure_active();
		return this._worker_lifecycle.session();
	}

	/** Responsibilities: _Python worker session cleanup_. **/
	public async close_worker_session(): Promise<void> {
		const worker_session = this._worker_lifecycle.session();
		if (!worker_session.active()) {
			return;
		}
		await worker_session.close();
	}

	/** Responsibilities: _complete-cache input boundary_. **/
	public input_files(repo_root: string, configured: readonly string[]): LintInputFiles {
		const inputs = this._dependencies.input_file_selector.input_files(repo_root, configured, []);
		return {
			files: [...inputs.files],
			project_files: [...inputs.project_files],
			ignored_files: [...inputs.ignored_files],
			markdown_files: [...inputs.markdown_files],
			ignore_files: [...inputs.ignore_files],
		};
	}

	/** Responsibilities: _creation complete lint reporting_. **/
	public lint_report(options: LintReportOptions, mode: LintReportMode = 0): LintExecutionReport {
		this._worker_lifecycle.ensure_active();
		const state_context = new LintRunStateContext({
			report: options,
			mode,
			input_file_selector: this._dependencies.input_file_selector,
			python_parser: this._worker_lifecycle.parser(),
			analysis_identity: this._dependencies.analysis_identity,
			file_io: this._dependencies.file_io,
			source_io: this._dependencies.source_io,
		});
		const state = state_context.state();
		const analysis_stage: LintAnalysisStage = {
			state,
			stage_timer: options.stage_timer,
			context_identity: options.stage_timer.measure("project-analysis-identity", () =>
				this._dependencies.analysis_identity.context(state.context.files()),
			),
		};
		const result = this._dependencies.lint_run_analysis.collect(analysis_stage);
		return { context: state.context, report: result };
	}
}
