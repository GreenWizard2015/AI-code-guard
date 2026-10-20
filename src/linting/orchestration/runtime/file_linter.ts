import { PythonScanner } from "src/linting/orchestration/runtime/python/python_scanner";
import type { FileViolationCollectorContract, CodingRuleLinterContract, LintStageTimerContract } from "src/shared_services_protocols";
import type { FileAnalysisCacheContract } from "src/cache_protocols";
import type { ViolationContract } from "src/reporting_protocols";
import type { TypeScriptFileScannerContract } from "src/typescript_analysis_protocols";
import type { LintSourceRecord } from "src/source_types";
import type { CacheState } from "src/project_analysis_types";
import type { FileLinterOptions, PythonProjectNames } from "src/model/types/types";
import type { FileLintRunOptions } from "src/core/types";
import { TypeScriptFileScanner } from "src/linting/orchestration/runtime/type_script_file_scanner";
import { LintStageTimer } from "src/lint_stage_timer";
import { FileAnalysisCache } from "src/linting/orchestration/runtime/file_analysis_cache";
import { PYTHON_LANGUAGE, TYPESCRIPT_LANGUAGE } from "src/constants";
import type { CachedFileOptions, FileLintOptions, FileAnalysisOptions } from "src/linting/orchestration/runtime/types";
import type { IOContract } from "src/io/protocols";
/** Responsibilities: _source file analysis_, _file lint orchestration_. **/
export class FileLinter {
	private readonly typescript_scanner: TypeScriptFileScannerContract;
	private readonly python_scanner: PythonScanner;
	private readonly cache_enabled: boolean;
	private readonly file_io: IOContract;

	/** Responsibilities: _normalization source record scanning_. **/
	private scan_source(
		source: LintSourceRecord,
		stage_timer: LintStageTimerContract,
		names: PythonProjectNames,
	): ViolationContract[] {
		if (source.python()) {
			return this.python_scanner.lint_python_file({
				file_name: source.file_name,
				source_file: source.absolute_path,
				text: source.text,
				project_class_names: names.project_class_names,
				python_class_names: names.project_class_names,
				project_protocol_names: names.project_protocol_names,
				project_type_names: names.project_type_names,
				normalized_ast: source.normalized_ast,
			});
		}
		return this.typescript_scanner.scan(
			source.file_name,
			source.text,
			source.typescript_ast,
			source.traversal,
			stage_timer,
		);
	}

	/** Responsibilities: _selection supplied stage timer_. **/
	private stage_timer(...timers: LintStageTimerContract[]): LintStageTimerContract {
		if (timers.length === 0) {
			return new LintStageTimer();
		}
		return timers[0];
	}

	/** Responsibilities: _initialization project context rule_. **/
	/** Responsibilities: _directory file violations_. **/
	private directory_issues(
		violations: ViolationContract[],
		source: LintSourceRecord,
		stage_timer: LintStageTimerContract,
		repo_root: string,
		violation_collector: FileViolationCollectorContract,
	): void {
		let language = TYPESCRIPT_LANGUAGE;
		if (source.python()) {
			language = PYTHON_LANGUAGE;
		}
		stage_timer.measure(`file-analysis.${language}.post-directory`, () =>
			violation_collector.append_directory(violations, source, source.relative_path, source.text, repo_root),
		);
	}

	/** Responsibilities: _remaining file violations_. **/
	private remaining_issues(
		violations: ViolationContract[],
		source: LintSourceRecord,
		stage_timer: LintStageTimerContract,
		violation_collector: FileViolationCollectorContract,
		coding_rule_linter: CodingRuleLinterContract,
	): void {
		let language = TYPESCRIPT_LANGUAGE;
		if (source.python()) {
			language = PYTHON_LANGUAGE;
		}
		stage_timer.measure(`file-analysis.${language}.post-remaining`, () =>
			violation_collector.append_remaining_violations(
				{
					violations,
					source,
					file: source.relative_path,
					text: source.text,
					python: source.python(),
					stage_timer,
				},
				coding_rule_linter,
			),
		);
	}

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

	/** Responsibilities: _file analysis_. **/
	private uncached_file(options: FileLintOptions, source: LintSourceRecord, ignored: boolean): ViolationContract[] {
		const violations = this.analyze_file({
			source,
			ignored,
			stage_timer: options.stage_timer,
			names: options.names,
			repo_root: options.repo_root,
			coding_rule_linter: options.coding_rule_linter,
			violation_collector: options.violation_collector,
		});
		if (this.cache_enabled) {
			options.stage_timer.measure("file-analysis.file-cache-write", () =>
				options.cache.write(options.file, source.text, ignored, violations),
			);
		}
		return violations;
	}

	/** Responsibilities: _file analysis selection_, _post-analysis violations_. **/
	private analyze_file(options: FileAnalysisOptions): ViolationContract[] {
		const { source, ignored, stage_timer, names, repo_root, coding_rule_linter, violation_collector } = options;
		if (ignored) {
			if (source.typescript()) {
				return this.typescript_scanner.scan_ignored(source, stage_timer);
			}
			return [];
		}
		const violations = this.scan_source(source, stage_timer, names);
		this.directory_issues(violations, source, stage_timer, repo_root, violation_collector);
		this.remaining_issues(violations, source, stage_timer, violation_collector, coding_rule_linter);
		return violations;
	}

	/** Responsibilities: _single file lint execution_. **/
	private lint_file(
		file: string,
		options: FileLintRunOptions,
		stage_timer: LintStageTimerContract,
		cache: FileAnalysisCacheContract,
	): ViolationContract[] {
		const source = options.context.source_record(file);
		let language = TYPESCRIPT_LANGUAGE;
		if (source.python()) {
			language = PYTHON_LANGUAGE;
		}
		const language_stage = `file-analysis.${language}`;
		const file_stage = `${language_stage}.${source.relative_path}`;
		return stage_timer.measure(file_stage, () =>
			stage_timer.measure(language_stage, () =>
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
			),
		);
	}

	/** Responsibilities: _initialization project context rule_. **/
	constructor(options: FileLinterOptions) {
		this.typescript_scanner = new TypeScriptFileScanner(options);
		this.python_scanner = new PythonScanner(options.repo_root, options.context.files());
		this.cache_enabled = options.cache_enabled;
		this.file_io = options.file_io;
		if (this.cache_enabled) {
			const file_analysis_cache = new FileAnalysisCache(
				options.repo_root,
				options.context.files(),
				options.analysis_identity,
				this.file_io,
				options.context.source_io,
			);
			file_analysis_cache.clean_unused_records(options.context.files());
		}
	}

	/** Responsibilities: _lint file output its_. **/
	public lint(options: FileLintOptions): ViolationContract[] {
		const source = options.context.source_record(options.file);
		const ignored = options.ignored_files.has(options.file);
		if (this.cache_enabled) {
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
		return this.uncached_file(options, source, ignored);
	}

	/** Responsibilities: _lint requested files merge_. **/
	public lint_files(options: FileLintRunOptions): ViolationContract[] {
		const violations: ViolationContract[] = [];
		const stage_timer = this.stage_timer(...options.timers);
		const cache = new FileAnalysisCache(
			options.repo_root,
			options.context.files(),
			options.analysis_identity,
			this.file_io,
			options.context.source_io,
		);
		for (const file of options.files) {
			violations.push(...this.lint_file(file, options, stage_timer, cache));
		}
		return violations;
	}
}
