import { PYTHON_LANGUAGE, TYPESCRIPT_CACHE_OWNER, TYPESCRIPT_LANGUAGE } from "src/constants";
import type { FileLintRunOptions } from "src/core/types";
import type { IOContract } from "src/io/protocols";
import { LintStageTimer } from "src/lint_stage_timer";
import type { FileLintExecution, FileLinterWorkerContract } from "src/linting/file_linter_worker_coordinator_types";
import { FileAnalysisCache } from "src/linting/orchestration/runtime/file_linting/worker_coordination/file_analysis_cache";
import { FileLinterWorkerCoordinator } from "src/linting/orchestration/runtime/file_linting/worker_coordination/file_linter_worker_coordinator";
import { FilePostAnalysis } from "src/linting/orchestration/runtime/file_linting/worker_coordination/file_post_analysis";
import { PythonScanner } from "src/linting/orchestration/runtime/python/python_scanner";
import { TypeScriptFileScanner } from "src/linting/orchestration/runtime/typescript/type_script_file_scanner";
import type { CachedFileOptions, FileAnalysisOptions, FileLintOptions } from "src/linting/types";
import type { FileLinterOptions } from "src/model_types";
import type { CacheState } from "src/project_analysis_types";
import type { ViolationContract } from "src/reporting_protocols";
import type { CallableOperation } from "src/runtime_types";
import type { LintStageTimerContract } from "src/shared_services_protocols";
import type { TypeScriptFileScannerContract } from "src/typescript_analysis_protocols";

/** Responsibilities: _source file analysis_, _file lint orchestration_. **/
export class FileLinter implements FileLinterWorkerContract {
	private readonly _typescript_scanner: TypeScriptFileScannerContract;
	private readonly _python_scanner: PythonScanner;
	private readonly _cache_enabled: boolean;
	private readonly _file_io: IOContract;
	private readonly _options: FileLinterOptions;

	/** Responsibilities: _normalization source record scanning_. **/
	private scan_source(options: FileAnalysisOptions): ViolationContract[] {
		const { source, stage_timer, names } = options;
		if (source.language === "python") {
			return this._python_scanner.lint_python_file(
				{
					file_name: source.file_name,
					source_file: source.absolute_path,
					text: source.text,
					project_class_names: names.project_class_names,
					python_class_names: names.project_class_names,
					project_protocol_names: names.project_protocol_names,
					project_type_names: names.project_type_names,
					project_alias_names: names.project_alias_names,
					normalized_ast: source.normalized_ast,
				},
				stage_timer,
			);
		}
		this._typescript_scanner.prepare_source(source, stage_timer);
		return [];
	}

	/** Responsibilities: _selection supplied stage timer_. **/
	private stage_timer(...timers: LintStageTimerContract[]): LintStageTimerContract {
		if (timers.length === 0) {
			return new LintStageTimer();
		}
		const timer = timers.at(0);
		if (timer === undefined) {
			return new LintStageTimer();
		}
		return timer;
	}

	/** Responsibilities: _initialization project context rule_. **/
	/** Responsibilities: _cached file result lookup_. **/
	private cached_file(options: CachedFileOptions): CacheState<ViolationContract[]> {
		const { file, source, ignored, stage_timer, cache } = options;
		const cached = stage_timer.measure("file-analysis.file-cache-read", () =>
			cache.cached_violations(file, source.text, ignored),
		);
		if (!cached.available) {
			return { available: false, value: [] };
		}
		return { available: true, value: [...cached.value] };
	}

	/** Responsibilities: _file analysis selection_, _post-analysis violations_. **/
	private analyze_file(options: FileAnalysisOptions): ViolationContract[] {
		const { source, ignored, stage_timer } = options;
		if (ignored) {
			if (source.language === TYPESCRIPT_CACHE_OWNER) {
				return this._typescript_scanner.scan_ignored(source, stage_timer);
			}
			return [];
		}
		const violations = this.scan_source(options);
		const post_analysis = new FilePostAnalysis(options, violations);
		post_analysis.append_directory();
		post_analysis.append_remaining();
		return violations;
	}

	/** Responsibilities: _nested file stage timing_. **/
	private measure_file_stages<T>(
		stage_timer: LintStageTimerContract,
		stages: readonly string[],
		operation: CallableOperation<T>,
	): T {
		let nested_operation = operation;
		let index = stages.length;
		while (index > 0) {
			index -= 1;
			const stage = stages[index];
			if (stage === undefined) {
				continue;
			}
			const inner_operation = nested_operation;
			nested_operation = (): T => stage_timer.measure(stage, inner_operation);
		}
		return nested_operation();
	}

	/** Responsibilities: _file analysis_. **/
	private uncached_file(options: FileLintOptions, ignored: boolean): ViolationContract[] {
		const source = options.context.source_record(options.file);
		const violations = this.analyze_file({
			source,
			ignored,
			stage_timer: options.stage_timer,
			names: options.names,
			repo_root: options.repo_root,
			coding_rule_linter: options.coding_rule_linter,
			violation_collector: options.violation_collector,
		});
		if (this._cache_enabled) {
			options.stage_timer.measure("file-analysis.file-cache-write", () =>
				options.cache.write(options.file, source.text, ignored, violations),
			);
		}
		return violations;
	}

	/** Responsibilities: _file lint inputs_. **/
	private file_options(
		file: string,
		execution: FileLintExecution,
		stage_timer: LintStageTimerContract,
	): FileLintOptions {
		const { source, services } = execution.options;
		const { cache } = execution;
		return {
			file,
			repo_root: source.repo_root,
			stage_timer,
			names: source.names,
			context: source.context,
			ignored_files: source.ignored_files,
			cache,
			coding_rule_linter: services.coding_rule_linter,
			violation_collector: services.violation_collector,
		};
	}

	/** Responsibilities: _initialization project context rule_. **/
	public constructor(options: FileLinterOptions) {
		this._options = options;
		this._typescript_scanner = new TypeScriptFileScanner(options);
		this._python_scanner = new PythonScanner(options.repo_root, options.context.files(), options.stage_timer);
		this._cache_enabled = options.cache_enabled;
		this._file_io = options.file_io;
	}

	/** Responsibilities: _single file lint execution_. **/
	public lint_file(file: string, execution: FileLintExecution): ViolationContract[] {
		const { source, services } = execution.options;
		const stage_timer = this.stage_timer(...services.timers);
		const source_record = source.context.source_record(file);
		let language = TYPESCRIPT_LANGUAGE;
		if (source_record.language === "python") {
			language = PYTHON_LANGUAGE;
		}
		const language_stage = `file-analysis.${language}`;
		const file_stage = `${language_stage}.file:${source_record.relative_path}`;
		const lint_options = this.file_options(file, execution, stage_timer);
		return this.measure_file_stages(stage_timer, [file_stage, language_stage], () => this.lint(lint_options));
	}

	/** Responsibilities: _lint file output its_. **/
	public lint(options: FileLintOptions): ViolationContract[] {
		const source = options.context.source_record(options.file);
		const ignored = options.ignored_files.has(options.file);
		if (this._cache_enabled) {
			const cached = this.cached_file({
				file: options.file,
				source,
				ignored,
				stage_timer: options.stage_timer,
				cache: options.cache,
			});
			if (cached.available) {
				return cached.value;
			}
		}
		return this.uncached_file(options, ignored);
	}

	/** Responsibilities: _lint requested files merge_. **/
	public lint_files(options: FileLintRunOptions): ViolationContract[] {
		const { source, services } = options;
		const cache = new FileAnalysisCache({
			repo_root: source.repo_root,
			analysis_identity: source.analysis_identity,
			context_identity: source.context_identity,
			file_io: this._file_io,
			source_io: source.context.source_io(),
		});
		if (this._cache_enabled && services.clean_cache_records) {
			cache.clean_unused_records(source.context.files());
		}
		const execution: FileLintExecution = { options, cache };
		const coordinator = new FileLinterWorkerCoordinator({
			linter_options: this._options,
			execution,
			linter: this,
		});
		return coordinator.violations();
	}
}
