import { relative, resolve } from "node:path";
import { PYTHON_LANGUAGE, TYPESCRIPT_LANGUAGE } from "src/constants";
import { FileLintAnalysis } from "src/core/lint-analysis/file_lint_analysis";
import { GlobalAnalysisRun } from "src/core/lint-analysis/global_analysis_run";
import { UnusedCode } from "src/core/project-source/unused_code";
import type { FileLintAnalysisOptions } from "src/core/types";
import type { IOContract } from "src/io/protocols";
import type {
	LintAnalysisStage,
	LintRunCacheState,
	LintRunInventory,
	LintRunResult,
	LintRunState,
} from "src/project_analysis_types";
import type { ViolationContract } from "src/reporting_protocols";
import { DirectoryRules } from "src/rules/support/directory_rules";
import type {
	LintRunAnalysisContract,
	ProjectAnalysisIdentityContract,
	TextFileDiscoveryContract,
} from "src/runtime_protocols";
import type { LintProjectContextContract, LintStageTimerContract } from "src/shared_services_protocols";
import type { ProjectSourceIOContract, ProjectSourceScanContract } from "src/source_protocols";

/** Responsibilities: _analysis orchestration_, _diagnostic collection_. **/
export class LintRunAnalysis implements LintRunAnalysisContract {
	private readonly _text_files: TextFileDiscoveryContract;
	private readonly _analysis_identity: ProjectAnalysisIdentityContract;
	private readonly _file_io: IOContract;
	private readonly _source_io: ProjectSourceIOContract;
	private readonly _unused_code: UnusedCode;

	/** Responsibilities: _unused Python symbol filtering_. **/
	private unused_python(
		repo_root: string,
		inventory: LintRunInventory,
		context: LintProjectContextContract,
		scanner: ProjectSourceScanContract,
		cache: LintRunCacheState,
	): ViolationContract[] {
		if (!cache.global_enabled && !cache.project_analysis_rules) {
			return [];
		}
		const target_files = new Set(inventory.files.map((file) => relative(repo_root, file).replaceAll("\\", "/")));
		const python_files = context
			.files()
			.filter((source) => source.language === PYTHON_LANGUAGE)
			.map((source) => resolve(repo_root, source.relative_path));
		return this._unused_code
			.collect_scanner_violations(repo_root, scanner, python_files)
			.filter((violation) => target_files.has(violation.file().replaceAll("\\", "/")));
	}

	/** Responsibilities: _analysis dependency initialization_. **/
	public constructor(
		text_files: TextFileDiscoveryContract,
		analysis_identity: ProjectAnalysisIdentityContract,
		file_io: IOContract,
		source_io: ProjectSourceIOContract,
	) {
		this._text_files = text_files;
		this._analysis_identity = analysis_identity;
		this._file_io = file_io;
		this._source_io = source_io;
		this._unused_code = new UnusedCode();
	}

	/** Responsibilities: _directory-level violations collection_. **/
	public collect_directory(state: LintRunState): ViolationContract[] {
		const analyzed_files = state.inventory.files.filter((file) => !state.inventory.ignored_files.has(file));
		const records = analyzed_files.map((file) => [file, state.context.source_record(file)] as const);
		if (records.some(([, source]) => source.language === TYPESCRIPT_LANGUAGE)) {
			return [];
		}
		const class_counts = new Map(
			records.map(([file, source]) => [file, source.normalized_ast.source.classes] as const),
		);
		const source_asts = new Map(records.map(([file, source]) => [file, source.normalized_ast] as const));
		const directory_rules = new DirectoryRules(this._file_io, state.context.source_io());
		return directory_rules.collect_directory_violations(analyzed_files, state.repo_root, class_counts, source_asts, {
			virtual_project: state.cache.virtual_project,
			files: state.inventory.files,
		});
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

	/** Responsibilities: _analysis phase ordering_, _violation aggregation_. **/
	public collect(stage: LintAnalysisStage): LintRunResult {
		const state = stage.state;
		const timer = stage.stage_timer;
		const violations = [
			...timer.measure("directory-analysis", () => this.collect_directory(state)),
			...timer.measure("file-analysis", () => this.collect_file(state, timer, stage.context_identity)),
			...timer.measure("global-analysis", () => this.collect_global(stage)),
			...timer.measure("unused-files", () =>
				this.unused_python(state.repo_root, state.inventory, state.context, state.project_scope.scanner, state.cache),
			),
			...timer.measure("markdown-analysis", () =>
				this._text_files
					.for_project(state.repo_root, state.inventory.ignored_directories)
					.violations_for_files(state.inventory.markdown_files, state.source_texts),
			),
		];
		return { files: state.inventory.files, violations };
	}
}
