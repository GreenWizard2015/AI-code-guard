import { ProjectAnalysisIdentity } from "src/core/project-source/project_analysis_identity";
import { ProjectLintExecution } from "src/core/project_lint_execution";
import type { ProjectLintExecutionContract, ProjectLintSessionDependencies } from "src/core/types";
import type { IOContract } from "src/io/protocols";
import type { LintRunResult } from "src/project_analysis_types";
import type { LintRunRuntimeContract } from "src/runtime_protocols";
import type { LintStageTimerContract } from "src/shared_services_protocols";
import type { ProjectSourceIOContract } from "src/source_protocols";
import type { UnusedCodeContract } from "src/source_protocols";
import type { CliOptions } from "src/task_types";

/** Responsibilities: _project analysis session_, _execution dependencies_. **/
export class ProjectLintSession {
	private readonly _execution_dependencies: ProjectLintSessionDependencies;

	/** Responsibilities: _project analysis dependencies_. **/
	public constructor(file_io: IOContract, source_io: ProjectSourceIOContract, runtime: LintRunRuntimeContract) {
		this._execution_dependencies = {
			lint_run_factory: runtime,
			file_io,
			source_io,
			analysis_identity: new ProjectAnalysisIdentity(file_io),
		};
	}

	/** Responsibilities: _project execution composition_. **/
	public execution(
		options: CliOptions,
		stage_timer: LintStageTimerContract,
		unused_code: UnusedCodeContract,
	): ProjectLintExecutionContract {
		return new ProjectLintExecution({
			...this._execution_dependencies,
			options,
			stage_timer,
			unused_code,
		});
	}

	/** Responsibilities: _project analysis execution_. **/
	public analyze(
		options: CliOptions,
		stage_timer: LintStageTimerContract,
		unused_code: UnusedCodeContract,
	): LintRunResult {
		return this.execution(options, stage_timer, unused_code).run();
	}
}
