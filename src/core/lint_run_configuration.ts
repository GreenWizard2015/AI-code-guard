import { LintProjectContextCreator } from "src/core/lint_project_context_creator";
import { ProjectNameRegistry } from "src/core/support/project_name_registry";
import { resolve } from "node:path";
import type {
	LintProjectContextContract,
	LintInputFileSelectorContract,
	LintRunAnalysisContract,
	LintStageTimerContract,
	PythonAstDataContract,
	ProjectSourceIOContract,
} from "src/protocols";
import { LintRunAnalysis } from "src/core/lint_run_analysis";
import type { LintAnalysisStage, LintRunState, ProjectNames } from "src/types";
import type { LintInputFiles } from "src/types";
import type { LintExecutionReport } from "src/types";
import { PythonAstData } from "src/core/python_ast_data";
import { PythonAstBridge } from "src/core/python_ast_bridge";
import type { PythonAstWorkerContract } from "src/core/python-ast-worker.mjs";
import { PythonAstWorkerSession } from "external/python_ast_worker_session.mjs";
import { TextFileDiscovery } from "src/core/text_file_discovery";
import { DiagnosticRule } from "src/model/diagnostic_rule";
import { SourceNames } from "src/core/source_names";
import { LintInputFileSelector } from "src/core/lint_input_file_selector";
import { LintReportMode, type LintProjectAnalysis, type LintReportOptions } from "src/core/types";
import { ProjectAnalysisIdentity } from "src/core/project-source/project_analysis_identity";
import { InMemoryProjectSourceIO } from "src/io/in_memory_project_source_io";
import type { IOContract } from "src/io/protocols";

/** Responsibilities: _lint input discovery_, _project analysis assembly_. **/
export class LintRunConfiguration {
	private readonly source_names: SourceNames;
	private readonly text_files: TextFileDiscovery;
	public readonly input_file_selector: LintInputFileSelectorContract;
	private readonly lint_run_analysis: LintRunAnalysisContract;
	private readonly python_parser: PythonAstDataContract;
	private readonly python_worker_session: PythonAstWorkerSession;
	public readonly python_ast_worker: PythonAstWorkerContract;
	private readonly analysis_identity: ProjectAnalysisIdentity;
	private readonly file_io: IOContract;
	private readonly source_io: ProjectSourceIOContract;

	/** Responsibilities: _creation shared project context_. **/
	private create_project_context(
		repo_root: string,
		project_files: string[],
		stage_timer: LintStageTimerContract,
		source_texts: ReadonlyMap<string, string>,
		virtual_project: boolean,
	): LintProjectContextContract {
		let source_io = this.source_io;
		if (virtual_project) {
			source_io = new InMemoryProjectSourceIO(source_texts);
		}
		const context_factory = new LintProjectContextCreator(
			this.python_parser,
			this.analysis_identity,
			source_io,
			this.file_io,
		);
		return stage_timer.measure("startup.project-context", () =>
			context_factory.lint_context(repo_root, project_files, stage_timer, source_texts, virtual_project),
		);
	}

	/** Responsibilities: _ignored-directory normalization_. **/
	private ignored_directories(options: LintReportOptions): Set<string> {
		return new Set(
			options.ignored_directories
				.map((value) => value.trim())
				.filter((value) => value.length > 0)
				.map((value) => resolve(options.repo_root, value).replaceAll("\\", "/")),
		);
	}

	/** Responsibilities: _project name registry timing_. **/
	private project_names(
		options: LintReportOptions,
		project_files: string[],
		context: LintProjectContextContract,
	): ProjectNames {
		return options.stage_timer.measure("startup.project-names", () => {
			const registry = new ProjectNameRegistry({ project_files, context }, this.source_names);
			return registry.names(options.repo_root);
		});
	}

	/** Responsibilities: _project analysis state_. **/
	private project_analysis(
		options: LintReportOptions,
		mode: LintReportMode,
		project_files: string[],
	): LintProjectAnalysis {
		const context = this.create_project_context(
			options.repo_root,
			project_files,
			options.stage_timer,
			options.source_texts,
			mode === LintReportMode.IN_MEMORY_PROJECT,
		);
		const project_names = this.project_names(options, project_files, context);
		return { context, project_names };
	}

	/** Responsibilities: _normalization lint state assembly_. **/
	private lint_state(options: LintReportOptions, mode: LintReportMode): LintRunState {
		const project_files = options.stage_timer.measure(
			"startup.project-file-discovery",
			() => options.inputs.project_files,
		);
		const ignored_directories = this.ignored_directories(options);
		const { context, project_names } = this.project_analysis(options, mode, project_files);
		return {
			repo_root: options.repo_root,
			files: options.inputs.files,
			entry_files: [...options.entry_files],
			ignored_files: new Set(options.inputs.ignored_files),
			ignored_directories,
			project_files,
			markdown_files: options.inputs.markdown_files,
			...project_names,
			context,
			source_texts: options.source_texts,
			global_cache_enabled: mode === LintReportMode.PROJECT,
			virtual_project: mode === LintReportMode.IN_MEMORY_PROJECT,
		};
	}

	/** Responsibilities: _Python bridge dependency initialization_. **/
	public constructor(
		project_source_io: ProjectSourceIOContract,
		project_file_io: IOContract,
	) {
		this.source_names = new SourceNames();
		this.source_io = project_source_io;
		this.file_io = project_file_io;
		this.text_files = new TextFileDiscovery(new DiagnosticRule("cyrillic-comment"), project_source_io);
		this.input_file_selector = new LintInputFileSelector(this.text_files, project_source_io);
		this.analysis_identity = new ProjectAnalysisIdentity(project_file_io);
		this.lint_run_analysis = new LintRunAnalysis(
			this.text_files,
			this.analysis_identity,
			project_file_io,
			project_source_io,
		);
		const worker_bridge = new PythonAstBridge();
		this.python_worker_session = new PythonAstWorkerSession(
			process,
			worker_bridge.worker_arguments(),
			worker_bridge.worker_options(),
		);
		this.python_ast_worker = this.python_worker_session.worker_instance;
		this.python_parser = new PythonAstData({
			worker: this.python_ast_worker,
			analysis_identity: this.analysis_identity,
			split_batch_enabled: true,
			file_io: this.file_io,
		});
	}

	/** Responsibilities: _complete-cache input boundary_. **/
	public input_files(repo_root: string, configured: readonly string[]): LintInputFiles {
		const inputs = this.input_file_selector.input_files(repo_root, configured, []);
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
		const state = this.lint_state(options, mode);
		const analysis_stage: LintAnalysisStage = { state, stage_timer: options.stage_timer };
		const result = this.lint_run_analysis.collect(analysis_stage);
		return { context: state.context, report: result };
	}
}
