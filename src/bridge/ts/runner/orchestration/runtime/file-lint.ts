import { PythonScanner } from 'src/bridge/ts/runner/orchestration/runtime/python/python-scanner';
import type { LintStageTimerProtocol, TypeScriptAstFileProtocol, Violation } from 'src/protocols';
import type { LintFileNameContract, LintSourceRecord } from 'src/types';
import type { LintProjectContext } from 'src/protocols';
import type { FileLinterOptions } from 'src/bridge/ts/runner/orchestration/runtime/types';
import { TypeScriptScannerClass } from 'src/bridge/ts/runner/orchestration/runtime/typescript-scanner-class';
import { LintStageTimer } from 'src/stage-timing';
import { FileViolationCollector } from 'src/bridge/ts/runner/orchestration/runtime/file-violation-collector';
/** Responsibilities: _lint individual files stage_. **/
export class FileLinter {
	private readonly project_root: string;
	private readonly project_class_names: ReadonlySet<string>;

	private readonly project_protocol_names: ReadonlySet<string>;
	private readonly project_interface_names: ReadonlySet<string>;

	private readonly project_type_names: ReadonlySet<string>;
	private readonly project_contract_names: ReadonlySet<string>;

	private readonly context: LintProjectContext;

	private readonly ignored_files: ReadonlySet<string>;
	private readonly violation_collector: FileViolationCollector;

	/** Responsibilities: _normalization source record scanning_. **/
	private scan_source(source: LintSourceRecord, stage_timer: LintStageTimerProtocol): Violation[] {
		const python_scanner = new PythonScanner();

		if (source.python()) {
			return python_scanner.lint_python_file({
				file_name: source.file_name,
				text: source.text,
				project_class_names: this.project_class_names,
				project_protocol_names: this.project_protocol_names,
				project_type_names: this.project_type_names,
				normalized_ast: source.normalized_ast,
			});
		}
		return this.scan_typescript_file(
			source.file_name,
			source.text,
			source.typescript_ast,
			stage_timer
		);
	}

	/** Responsibilities: _TypeScript file aggregation scanning_. **/
	private scan_typescript_file(
		file_name: LintFileNameContract,
		text: string,
		ast_file: TypeScriptAstFileProtocol,
		stage_timer: LintStageTimerProtocol
	): Violation[] {
		const scanner = stage_timer.measure(
			'file-analysis.typescript.scanner-construction',
			() => new TypeScriptScannerClass({
				file_name,
				text,
				project_class_names: this.project_class_names,
				project_type_names: this.project_type_names,
				project_interface_names: this.project_interface_names,
				project_contract_names: this.project_contract_names,
				ast_file,
				stage_timer,
			})
		);
		stage_timer.measure('file-analysis.typescript.scanner-execution', () => scanner.scan());
		return scanner.violations;
	}

	/** Responsibilities: _application ignored-file handling output_. **/
	private lint_ignored_file(source: LintSourceRecord, stage_timer: LintStageTimerProtocol): Violation[] {
		if (!source.typescript()) {
			return [];
		}
		const scanner = stage_timer.measure(
			'file-analysis.typescript.scanner-construction',
			() => new TypeScriptScannerClass({
				file_name: source.file_name,
				text: source.text,
				project_class_names: this.project_class_names,
				project_type_names: this.project_type_names,
				project_interface_names: this.project_interface_names,
				project_contract_names: this.project_contract_names,
				ast_file: source.typescript_ast,
				stage_timer,
			})
		);
		stage_timer.measure('file-analysis.typescript.scanner-execution', () => scanner.scan_mixed_module());
		return scanner.violations;
	}

	/** Responsibilities: _selection supplied stage timer_. **/
	private stage_timer(...timers: LintStageTimerProtocol[]): LintStageTimerProtocol {
		if (timers.length === 0) {
			return new LintStageTimer();
		}
		return timers[0];
	}

	/** Responsibilities: _initialization project context rule_. **/
	/** Responsibilities: _directory file violations_. **/
	private directory_issues(
		violations: Violation[],
		source: LintSourceRecord,
		stage_timer: LintStageTimerProtocol
	): void {
		const language = source.python() ? 'python' : 'typescript';
		stage_timer.measure(
			`file-analysis.${language}.post-directory`,
			() => this.violation_collector.append_directory(
				violations, source, source.relative_path, source.text, this.project_root
			)
		);
	}

	/** Responsibilities: _remaining file violations_. **/
	private remaining_issues(
		violations: Violation[],
		source: LintSourceRecord,
		stage_timer: LintStageTimerProtocol
	): void {
		const language = source.python() ? 'python' : 'typescript';
		stage_timer.measure(
			`file-analysis.${language}.post-remaining`,
			() => this.violation_collector.append_remaining_violations({
				violations,
				source,
				file: source.relative_path,
				text: source.text,
				python: source.python(),
				stage_timer,
			})
		);
	}

	/** Responsibilities: _initialization project context rule_. **/
	constructor(options: FileLinterOptions) {
		this.project_root = options.repo_root;
		this.project_class_names = options.project_class_names;
		this.project_protocol_names = options.project_protocol_names;
		this.project_interface_names = options.project_interface_names;
		this.project_type_names = options.project_type_names;
		this.project_contract_names = options.project_contract_names;
		this.context = options.context;
		this.ignored_files = options.ignored_files;
		this.violation_collector = new FileViolationCollector();
	}

	/** Responsibilities: _lint file output its_. **/
	public lint(file: string, stage_timer: LintStageTimerProtocol): Violation[] {
		const source = this.context.source_record(file);
		if (this.ignored_files.has(file)) {
			return this.lint_ignored_file(source, stage_timer);
		}
		const violations = this.scan_source(source, stage_timer);
		this.directory_issues(violations, source, stage_timer);
		this.remaining_issues(violations, source, stage_timer);
		return violations;
	}

	/** Responsibilities: _lint requested files merge_. **/
	public lint_files(files: string[], ...timers: LintStageTimerProtocol[]): Violation[] {
		const violations: Violation[] = [];
		const stage_timer = this.stage_timer(...timers);
		for (const file of files) {
			let file_violations: Violation[];
			const source = this.context.source_record(file);
			const language = source.python() ? 'python' : 'typescript';
			const language_stage = `file-analysis.${language}`;
			const file_stage = `${language_stage}.${source.relative_path}`;
			file_violations = stage_timer.measure(
				file_stage,
				() => stage_timer.measure(language_stage, () => this.lint(file, stage_timer))
			);
			violations.push(...file_violations);
		}
		return violations;
	}

}
