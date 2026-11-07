import { TYPESCRIPT_LANGUAGE } from "src/constants";
import { FileLintAnalysis } from "src/core/lint-analysis/file_lint_analysis";
import { GlobalAnalysisRun } from "src/core/lint-analysis/global_analysis_run";
import type { FileLintAnalysisOptions } from "src/core/types";
import type { IOContract } from "src/io/protocols";
import type { LintAnalysisStage, LintRunResult, LintRunState } from "src/project_analysis_types";
import type { ViolationContract } from "src/reporting_protocols";
import { DirectoryRules } from "src/rules/support/directory_rules";
import type { LintRunAnalysisContract, TextFileDiscoveryContract } from "src/runtime_protocols";
import type { ProjectAnalysisIdentityContract } from "src/runtime_protocols";
import type { DirectoryRulesContract, LintStageTimerContract } from "src/shared_services_protocols";
import type { ProjectSourceIOContract } from "src/source_protocols";

/** Responsibilities: _directory analysis_, _file analysis_, _global analysis coordination_. **/
export class LintRunAnalysis implements LintRunAnalysisContract {
	private readonly _directory_rules: DirectoryRulesContract;
	private readonly _text_files: TextFileDiscoveryContract;
	private readonly _analysis_identity: ProjectAnalysisIdentityContract;
	private readonly _file_io: IOContract;
	private readonly _source_io: ProjectSourceIOContract;

	/** Responsibilities: _analysis dependency initialization_. **/
	public constructor(
		text_files: TextFileDiscoveryContract,
		analysis_identity: ProjectAnalysisIdentityContract,
		file_io: IOContract,
		source_io: ProjectSourceIOContract,
	) {
		this._directory_rules = new DirectoryRules(file_io, source_io);
		this._text_files = text_files;
		this._analysis_identity = analysis_identity;
		this._file_io = file_io;
		this._source_io = source_io;
	}

	/** Responsibilities: _directory-level violations collection_. **/
	public collect_directory(state: LintRunState): ViolationContract[] {
		const analyzed_files = state.inventory.files.filter((file) => !state.inventory.ignored_files.has(file));
		if (analyzed_files.some((file) => state.context.source_record(file).language === TYPESCRIPT_LANGUAGE)) {
			return [];
		}
		const class_counts = new Map(
			analyzed_files.map((file) => [file, state.context.source_record(file).normalized_ast.source.classes]),
		);
		const source_asts = new Map(analyzed_files.map((file) => [file, state.context.source_record(file).normalized_ast]));
		return this._directory_rules.collect_directory_violations(
			analyzed_files,
			state.repo_root,
			class_counts,
			source_asts,
			{ virtual_project: state.cache.virtual_project, files: state.inventory.files },
		);
	}

	/** Responsibilities: _file-level violations collection_. **/
	public collect_file(
		state: LintRunState,
		stage_timer: LintStageTimerContract,
		context_identity: string,
	): ViolationContract[] {
		const analysis = new FileLintAnalysis({
			state,
			stage_timer,
			analysis_identity: this._analysis_identity,
			context_identity,
			file_io: this._file_io,
			source_io: this._source_io,
		} satisfies FileLintAnalysisOptions);
		return analysis.collect();
	}

	/** Responsibilities: _global violations collection_. **/
	public collect_global(stage: LintAnalysisStage): ViolationContract[] {
		const analysis = new GlobalAnalysisRun({
			stage,
			analysis_identity: this._analysis_identity,
			file_io: this._file_io,
		});
		return analysis.collect();
	}

	/** Responsibilities: _every analysis stage execution_, _combine violations_. **/
	public collect(stage: LintAnalysisStage): LintRunResult {
		const directory_violations = stage.stage_timer.measure("directory-analysis", () =>
			this.collect_directory(stage.state),
		);
		const file_violations = stage.stage_timer.measure("file-analysis", () =>
			this.collect_file(stage.state, stage.stage_timer, stage.context_identity),
		);
		const global_violations = stage.stage_timer.measure("global-analysis", () => this.collect_global(stage));
		const text_violations = stage.stage_timer.measure("markdown-analysis", () =>
			this._text_files
				.for_project(stage.state.repo_root, stage.state.inventory.ignored_directories)
				.violations_for_files(stage.state.inventory.markdown_files, stage.state.source_texts),
		);
		return {
			files: stage.state.inventory.files,
			violations: [...directory_violations, ...file_violations, ...global_violations, ...text_violations],
		};
	}
}
