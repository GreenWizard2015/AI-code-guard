import type { FileAnalysisCacheContract } from "src/cache_protocols";
import { PYTHON_LANGUAGE, TYPESCRIPT_CACHE_OWNER, TYPESCRIPT_LANGUAGE } from "src/constants";
import type { FileLintRunOptions } from "src/core/types";
import type { IOContract } from "src/io/protocols";
import { LintStageTimer } from "src/lint_stage_timer";
import { FileAnalysisCache } from "src/linting/orchestration/runtime/file_analysis_cache";
import { PythonScanner } from "src/linting/orchestration/runtime/python/python_scanner";
import type { CachedFileOptions, FileAnalysisOptions, FileLintOptions } from "src/linting/orchestration/runtime/types";
import { TypeScriptFileScanner } from "src/linting/orchestration/runtime/typescript/type_script_file_scanner";
import type { FileLinterOptions, PythonProjectNames } from "src/model_types";
import type { CacheState } from "src/project_analysis_types";
import type { ViolationContract } from "src/reporting_protocols";
import type { CallableOperation } from "src/runtime_types";
import type { LintStageTimerContract } from "src/shared_services_protocols";
import type { LintSourceRecordData } from "src/source_types";
import type { TypeScriptFileScannerContract } from "src/typescript_analysis_protocols";
/** Responsibilities: _source file analysis_, _file lint orchestration_. **/
export class FileLinter {
	private readonly _typescript_scanner: TypeScriptFileScannerContract;
	private readonly _python_scanner: PythonScanner;
	private readonly _cache_enabled: boolean;
	private readonly _file_io: IOContract;

	/** Responsibilities: _normalization source record scanning_. **/
	private scan_source(
		source: LintSourceRecordData,
		stage_timer: LintStageTimerContract,
		names: PythonProjectNames,
	): ViolationContract[] {
		if (source.language === "python") {
			return this._python_scanner.lint_python_file({
				file_name: source.file_name,
				source_file: source.absolute_path,
				text: source.text,
				project_class_names: names.project_class_names,
				python_class_names: names.project_class_names,
				project_protocol_names: names.project_protocol_names,
				project_type_names: names.project_type_names,
				project_alias_names: names.project_alias_names,
				normalized_ast: source.normalized_ast,
			});
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

	/** Responsibilities: _post-analysis file violations_. **/
	private append_post_analysis(options: FileAnalysisOptions, violations: ViolationContract[]): void {
		const { source, stage_timer, repo_root, violation_collector, coding_rule_linter } = options;
		let language = TYPESCRIPT_LANGUAGE;
		if (source.language === "python") {
			language = PYTHON_LANGUAGE;
		}
		stage_timer.measure(`file-analysis.${language}.post-directory`, () =>
			violation_collector.append_directory(violations, source, source.relative_path, source.text, repo_root),
		);
		stage_timer.measure(`file-analysis.${language}.post-remaining`, () =>
			violation_collector.append_remaining_violations(
				{
					violations,
					source,
					file: source.relative_path,
					text: source.text,
					python: source.language === "python",
					stage_timer,
				},
				coding_rule_linter,
			),
		);
	}

	/** Responsibilities: _file analysis selection_, _post-analysis violations_. **/
	private analyze_file(options: FileAnalysisOptions): ViolationContract[] {
		const { source, ignored, stage_timer, names } = options;
		if (ignored) {
			if (source.language === TYPESCRIPT_CACHE_OWNER) {
				return this._typescript_scanner.scan_ignored(source, stage_timer);
			}
			return [];
		}
		const violations = this.scan_source(source, stage_timer, names);
		this.append_post_analysis(options, violations);
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

	/** Responsibilities: _single file lint execution_. **/
	private lint_file(file: string, options: FileLintRunOptions, cache: FileAnalysisCacheContract): ViolationContract[] {
		const stage_timer = this.stage_timer(...options.timers);
		const source = options.context.source_record(file);
		let language = TYPESCRIPT_LANGUAGE;
		if (source.language === "python") {
			language = PYTHON_LANGUAGE;
		}
		const language_stage = `file-analysis.${language}`;
		const file_stage = `${language_stage}.file:${source.relative_path}`;
		return this.measure_file_stages(stage_timer, [file_stage, language_stage], () =>
			this.lint({
				file,
				repo_root: options.repo_root,
				stage_timer,
				names: options.names,
				context: options.context,
				ignored_files: options.ignored_files,
				cache,
				coding_rule_linter: options.coding_rule_linter,
				violation_collector: options.violation_collector,
			}),
		);
	}

	/** Responsibilities: _initialization project context rule_. **/
	public constructor(options: FileLinterOptions) {
		this._typescript_scanner = new TypeScriptFileScanner(options);
		this._python_scanner = new PythonScanner(options.repo_root, options.context.files());
		this._cache_enabled = options.cache_enabled;
		this._file_io = options.file_io;
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
		const violations: ViolationContract[] = [];
		const cache = new FileAnalysisCache({
			repo_root: options.repo_root,
			analysis_identity: options.analysis_identity,
			context_identity: options.context_identity,
			file_io: this._file_io,
			source_io: options.context.source_io(),
		});
		if (this._cache_enabled) {
			cache.clean_unused_records(options.context.files());
		}
		for (const file of options.files) {
			violations.push(...this.lint_file(file, options, cache));
		}
		return violations;
	}
}
