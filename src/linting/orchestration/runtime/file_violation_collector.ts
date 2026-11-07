import { FUNCTION_MODULE_NAMES, MAX_IMPORT_FAN_OUT } from "src/constants";
import { PYTHON_LANGUAGE } from "src/constants";
import type { IOContract } from "src/io/protocols";
import { FileRemainingTextRules } from "src/linting/orchestration/runtime/file_remaining_text_rules";
import { FileRemainingViolationCollector } from "src/linting/orchestration/runtime/file_remaining_violation_collector";
import { ImportFanOut } from "src/linting/orchestration/runtime/global-rules/import_fan_out";
import { PythonReexports } from "src/linting/orchestration/runtime/reexports/python_reexports";
import { DiagnosticRule } from "src/model/diagnostic_rule";
import type { RemainingViolationOptions } from "src/model_types";
import type { ViolationContract } from "src/reporting_protocols";
import { FunctionPlacementRules } from "src/rules/architecture/function_placement_rules";
import { DirectoryRules } from "src/rules/support/directory_rules";
import type { CodingRuleLinterContract, FileViolationCollectorContract } from "src/shared_services_protocols";
import type { ProjectSourceIOContract } from "src/source_protocols";
import type { LintSourceRecordData } from "src/source_types";
import type { TestFileViolationCollectorContract } from "src/testing_protocols";
import { TypeScriptReexports } from "src/type_script_reexports";

/** Responsibilities: _file violation collection_, _test-file delegation_. **/
export class FileViolationCollector implements FileViolationCollectorContract {
	private readonly _import_fan_out: ImportFanOut;
	private readonly _function_placement_rules: FunctionPlacementRules;
	private readonly _remaining_text_rules: FileRemainingTextRules;
	private readonly _tests: TestFileViolationCollectorContract;
	private readonly _file_io: IOContract;
	private readonly _source_io: ProjectSourceIOContract;

	/** Responsibilities: _remaining file violation initialization_. **/
	public constructor(
		tests: TestFileViolationCollectorContract,
		file_io: IOContract,
		source_io: ProjectSourceIOContract,
	) {
		this._tests = tests;
		this._file_io = file_io;
		this._source_io = source_io;
		this._import_fan_out = new ImportFanOut(MAX_IMPORT_FAN_OUT, new DiagnosticRule("import-fan-out"));
		this._function_placement_rules = new FunctionPlacementRules(FUNCTION_MODULE_NAMES);
		this._remaining_text_rules = new FileRemainingTextRules(
			new PythonReexports(new TypeScriptReexports(new DiagnosticRule("reexports")), /^[A-Za-z_]$/u, /^[A-Za-z0-9_]$/u),
		);
	}

	/** Responsibilities: _file-level remaining violation collection_. **/
	public append_remaining_violations(
		options: RemainingViolationOptions,
		coding_rule_linter: CodingRuleLinterContract,
	): void {
		const remaining = new FileRemainingViolationCollector(
			options,
			this._import_fan_out,
			this._function_placement_rules,
			this._remaining_text_rules,
			coding_rule_linter,
		);
		remaining.append_common_rules();
		remaining.append_metric_rules();
		remaining.append_singletons();
	}

	/** Responsibilities: _directory diagnostics_, _test file diagnostics_. **/
	public append_directory(
		violations: ViolationContract[],
		source: LintSourceRecordData,
		file: string,
		text: string,
		project_root: string,
	): void {
		if (source.language === PYTHON_LANGUAGE) {
			this._tests.append_location(violations, source, file);
			this._tests.append(violations, source, file, project_root);
			const directory_rules = new DirectoryRules(this._file_io, this._source_io);
			directory_rules.append_file_violation({
				violations,
				file,
				text,
				classes: source.normalized_ast.source.classes,
				docstring_spans: source.normalized_ast.module_declarations.docstring_spans,
				normalized_ast: source.normalized_ast,
			});
		}
	}
}
