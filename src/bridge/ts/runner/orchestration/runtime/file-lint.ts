import { PythonScanner } from 'src/bridge/ts/runner/orchestration/runtime/python/python-scanner';
import type { Violation } from 'src/protocols';
import type { LintFileNameContract, LintSourceRecord } from 'src/types';
import type { LintProjectContext } from 'src/protocols';
import { TypeScriptAstFile } from 'src/model/typescript-ast';
import type { FileLinterOptions } from 'src/bridge/ts/runner/orchestration/runtime/types';
import { TypeScriptScannerClass } from 'src/bridge/ts/runner/orchestration/runtime/typescript-scanner-class';
import { LintStageTimer } from 'src/bridge/ts/core/stage-timing';
import { FileViolationCollector } from 'src/bridge/ts/runner/orchestration/runtime/file-violation-collector';
/** Responsibilities: _lint individual files stage_. **/
export class FileLinter {
	private readonly project_class_names: ReadonlySet<string>;

	private readonly project_protocol_names: ReadonlySet<string>;

	private readonly project_type_names: ReadonlySet<string>;
	private readonly project_contract_names: ReadonlySet<string>;

	private readonly context: LintProjectContext;

	private readonly ignored_files: ReadonlySet<string>;
	private readonly violation_collector: FileViolationCollector;

	/** Responsibilities: _normalization source record scanning_. **/
	private scan_source(source: LintSourceRecord): Violation[] {
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
			source.typescript_ast
		);
	}

	/** Responsibilities: _TypeScript file aggregation scanning_. **/
	private scan_typescript_file(
		file_name: LintFileNameContract,
		text: string,
		ast_file: TypeScriptAstFile
	): Violation[] {
		const scanner = new TypeScriptScannerClass({
			file_name,
			text,
			project_class_names: this.project_class_names,
			project_type_names: this.project_type_names,
			project_contract_names: this.project_contract_names,
			ast_file,
		});
		scanner.scan();
		return scanner.violations;
	}

	/** Responsibilities: _application ignored-file handling output_. **/
	private lint_ignored_file(source: LintSourceRecord): Violation[] {
		if (!source.typescript()) {
			return [];
		}
		const scanner = new TypeScriptScannerClass({
			file_name: source.file_name,
			text: source.text,
			project_class_names: this.project_class_names,
			project_type_names: this.project_type_names,
			project_contract_names: this.project_contract_names,
			ast_file: source.typescript_ast,
		});
		scanner.scan_mixed_module();
		return scanner.violations;
	}

	/** Responsibilities: _selection supplied stage timer_. **/
	private stage_timer(...timers: LintStageTimer[]): LintStageTimer {
		if (timers.length === 0) {
			return new LintStageTimer();
		}
		return timers[0];
	}

	/** Responsibilities: _initialization project context rule_. **/
	constructor(options: FileLinterOptions) {
		this.project_class_names = options.project_class_names;
		this.project_protocol_names = options.project_protocol_names;
		this.project_type_names = options.project_type_names;
		this.project_contract_names = options.project_contract_names;
		this.context = options.context;
		this.ignored_files = options.ignored_files;
		this.violation_collector = new FileViolationCollector();
	}

	/** Responsibilities: _lint file output its_. **/
	public lint(file: string): Violation[] {
		const source = this.context.source_record(file);
		if (this.ignored_files.has(file)) {
			return this.lint_ignored_file(source);
		}
		const violations = this.scan_source(source);
		this.violation_collector.append_directory(
			violations, source, source.relative_path, source.text
		);
		this.violation_collector.append_remaining_violations(
			violations, source, source.relative_path, source.text, source.python()
		);
		return violations;
	}

	/** Responsibilities: _lint requested files merge_. **/
	public lint_files(files: string[], ...timers: LintStageTimer[]): Violation[] {
		const violations: Violation[] = [];
		const stage_timer = this.stage_timer(...timers);
		for (const file of files) {
			let file_violations: Violation[];
			const source = this.context.source_record(file);
			const language = source.python() ? 'python' : 'typescript';
			file_violations = stage_timer.measure_file(
				language,
				source.relative_path,
				() => this.lint(file)
			);
			violations.push(...file_violations);
		}
		return violations;
	}

}
