import { relative } from "node:path";
import { GlobalAnalysisCache } from "src/core/support/global_analysis_cache";
import { DirectoryRules } from "src/rules/support/directory_rules";
import { CodingRuleLinter } from "src/linting/orchestration/runtime/coding_rule_linter";
import { FileLinter } from "src/linting/orchestration/runtime/file_linter";
import { FileViolationCollector } from "src/linting/orchestration/runtime/file_violation_collector";
import { GlobalViolationCollector } from "src/linting/orchestration/runtime/global-analysis/global_violation_collector";
import { ProjectTestTargetImportPaths } from "src/linting/orchestration/runtime/test-targets/project_test_target_import_paths";
import type { FileLintRunOptions } from "src/core/types";
import type {
	CodingRuleLinterContract,
	DirectoryRulesContract,
	GlobalAnalysisCacheContract,
	LintRunAnalysisContract,
	LintStageTimerContract,
	ProjectSourceIOContract,
	TextFileDiscoveryContract,
} from "src/protocols";
import type { ViolationContract } from "src/protocols";
import type { ProjectAnalysisIdentityContract } from "src/protocols";
import type { LintAnalysisStage, LintRunResult, LintRunState } from "src/types";
import type { FileLinterOptions } from "src/model/types/types";
import type { IOContract } from "src/io/protocols";

/** Responsibilities: _directory analysis_, _file analysis_, _global analysis coordination_. **/
export class LintRunAnalysis implements LintRunAnalysisContract {
	private readonly directory_rules: DirectoryRulesContract;
	private readonly text_files: TextFileDiscoveryContract;
	private readonly analysis_identity: ProjectAnalysisIdentityContract;
	private readonly file_io: IOContract;
	private readonly source_io: ProjectSourceIOContract;

	/** Responsibilities: _global violations collection_. **/
	private collect_global_results(stage: LintAnalysisStage, target_file_set: ReadonlySet<string>): ViolationContract[] {
		const state = stage.state;
		const global_violation_collector = new GlobalViolationCollector({
			repo_root: state.repo_root,
			project_files: state.project_files,
			project_type_names: state.project_type_names,
			context: state.context,
			ignored_files: state.ignored_files,
			entry_files: state.entry_files,
		});
		const violations = global_violation_collector.collect_for(target_file_set, stage.stage_timer);
		return violations;
	}

	/** Responsibilities: _cached global violations_. **/
	private collect_global_cached(
		stage: LintAnalysisStage,
		target_file_set: ReadonlySet<string>,
		cache: GlobalAnalysisCacheContract,
	): ViolationContract[] {
		const violations = this.collect_global_results(stage, target_file_set);
		stage.stage_timer.measure("global-analysis.cache-write", () => cache.write(violations));
		return violations;
	}

	/** Responsibilities: _global cache identity_. **/
	private global_cache(stage: LintAnalysisStage, target_file_set: ReadonlySet<string>): GlobalAnalysisCacheContract {
		const state = stage.state;
		return new GlobalAnalysisCache({
			repo_root: state.repo_root,
			records: state.context.files(),
			files: target_file_set,
			ignored_files: state.ignored_files,
			entry_files: state.entry_files,
			identity: this.analysis_identity,
			file_io: this.file_io,
			source_io: this.source_io,
		});
	}

	/** Responsibilities: _file linter dependency configuration_. **/
	private file_linter_options(state: LintRunState): FileLinterOptions {
		return {
			repo_root: state.repo_root,
			project_names: {
				project_class_names: state.project_class_names,
				python_class_names: state.python_class_names,
				typescript_class_names: state.typescript_class_names,
				project_protocol_names: state.project_protocol_names,
				project_interface_names: state.project_interface_names,
				project_type_names: state.project_type_names,
				project_contract_names: state.project_contract_names,
			},
			context: state.context,
			ignored_files: state.ignored_files,
			analysis_identity: this.analysis_identity,
			cache_enabled: !state.virtual_project,
			file_io: this.file_io,
		};
	}

	/** Responsibilities: _file lint configuration_. **/
	private file_lint_options(state: LintRunState, stage_timer: LintStageTimerContract): FileLintRunOptions {
		const coding_rule_linter: CodingRuleLinterContract = new CodingRuleLinter(
			state.repo_root,
			state.context.source_io,
			!state.virtual_project,
		);
		const violation_collector = new FileViolationCollector(
			new ProjectTestTargetImportPaths(state.repo_root, state.context),
			state.context.files().map((record) => record.relative_path),
			this.file_io,
			this.source_io,
		);
		return {
			files: state.files,
			repo_root: state.repo_root,
			names: {
				project_class_names: state.python_class_names,
				project_protocol_names: state.project_protocol_names,
				project_type_names: state.project_type_names,
			},
			context: state.context,
			ignored_files: state.ignored_files,
			analysis_identity: this.analysis_identity,
			timers: [stage_timer],
			coding_rule_linter,
			violation_collector,
		};
	}

	/** Responsibilities: _analysis dependency initialization_. **/
	public constructor(
		text_files: TextFileDiscoveryContract,
		analysis_identity: ProjectAnalysisIdentityContract,
		file_io: IOContract,
		source_io: ProjectSourceIOContract,
	) {
		this.directory_rules = new DirectoryRules(file_io, source_io);
		this.text_files = text_files;
		this.analysis_identity = analysis_identity;
		this.file_io = file_io;
		this.source_io = source_io;
	}

	/** Responsibilities: _directory-level violations collection_. **/
	public collect_directory(state: LintRunState): ViolationContract[] {
		const analyzed_files = state.files.filter((file) => !state.ignored_files.has(file));
		const class_counts = new Map(
			analyzed_files.map((file) => [file, state.context.source_record(file).normalized_ast.classes.length]),
		);
		const source_asts = new Map(analyzed_files.map((file) => [file, state.context.source_record(file).normalized_ast]));
		return this.directory_rules.collect_directory_violations(
			analyzed_files,
			state.repo_root,
			class_counts,
			source_asts,
			{ virtual_project: state.virtual_project, files: state.files },
		);
	}

	/** Responsibilities: _file-level violations collection_. **/
	public collect_file(state: LintRunState, stage_timer: LintStageTimerContract): ViolationContract[] {
		const file_linter = new FileLinter(this.file_linter_options(state));
		const run_options = this.file_lint_options(state, stage_timer);
		return file_linter.lint_files(run_options);
	}

	/** Responsibilities: _global violations collection_. **/
	public collect_global(stage: LintAnalysisStage): ViolationContract[] {
		const state = stage.state;
		const target_file_set = new Set(state.files.flatMap((file) => [file, relative(state.repo_root, file)]));
		if (!state.global_cache_enabled) {
			return this.collect_global_results(stage, target_file_set);
		}
		if (process.env.NODE_ENV === "test") {
			return this.collect_global_results(stage, target_file_set);
		}
		const cache = this.global_cache(stage, target_file_set);
		const cached = stage.stage_timer.measure("global-analysis.cache-read", () => cache.cached_violations());
		if (cached.available) {
			return [...cached.value];
		}
		return this.collect_global_cached(stage, target_file_set, cache);
	}

	/** Responsibilities: _every analysis stage execution_, _combine violations_. **/
	public collect(stage: LintAnalysisStage): LintRunResult {
		const directory_violations = stage.stage_timer.measure("directory-analysis", () =>
			this.collect_directory(stage.state),
		);
		const file_violations = stage.stage_timer.measure("file-analysis", () =>
			this.collect_file(stage.state, stage.stage_timer),
		);
		const global_violations = stage.stage_timer.measure("global-analysis", () => this.collect_global(stage));
		const text_violations = stage.stage_timer.measure("markdown-analysis", () =>
			this.text_files.violations_for_files(stage.state.markdown_files, stage.state.repo_root, stage.state.source_texts),
		);
		return {
			files: stage.state.files,
			violations: [...directory_violations, ...file_violations, ...global_violations, ...text_violations],
		};
	}
}
