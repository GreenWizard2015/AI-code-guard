import { DiagnosticRule } from 'src/model/diagnostic-rule';
import type { Violation } from 'src/protocols';
import type { FunctionCount, NamedLine } from 'src/types';
import type { LintFileNameContract } from 'src/types';
import { INFO_FILE_FUNCTIONS, MAX_FILE_FUNCTIONS, MAX_FUNCTIONS_FILE } from 'src/constants';
import type { CountViolation, CountInput } from 'src/bridge/ts/runner/orchestration/runtime/types';

/** Responsibilities: _reporting per-file function counts_. **/
export class FileFunctionCountReporter {
	private readonly info_rule_id = 'file-function-count-info';
	private readonly warning_rule_id = 'file-function-count-warning';
	private readonly functions_rule_id = 'functions-file-max-count';

	/** Responsibilities: _informational function-count diagnostics addition_. **/
	private append_info(violations: Violation[], input: CountInput, max_count: number): void {
if (input.count <= INFO_FILE_FUNCTIONS || input.count > max_count) {
			return;
		}
		this.append_violation(violations, {
			...input,
			rule_id: this.info_rule_id,
			parameters: { count: String(input.count) },
		});
	}

	/** Responsibilities: _maximum function-count violations addition_. **/
	private append_max(
		violations: Violation[],
		input: CountInput,
		max_count: number,
		rule_id: string,
	): void {
		if (input.count <= max_count) {
			return;
		}
		this.append_violation(violations, {
			...input,
			rule_id,
			parameters: { count: String(input.count) },
		});
	}

	/** Responsibilities: _aggregation configuration function-count violation_. **/
	private append_violation(violations: Violation[], input: CountViolation): void {
		const rule = new DiagnosticRule(input.rule_id);
		const line = input.first_line + 1;
		const violation = rule.violation(input.file, line, input.parameters);
		violations.push(violation);
	}

	/** Responsibilities: _classification file participates function-count_. **/
	public reportable(file_name: LintFileNameContract): boolean {
		return !file_name.test();
	}

	/** Responsibilities: _aggregation function-count diagnostics source_. **/
	public append(
		violations: Violation[],
		file: string,
		file_name: LintFileNameContract,
		function_count: FunctionCount
	): void {
		if (!this.reportable(file_name)) {
			return;
		}
		const input = { file, count: function_count.count, first_line: function_count.first_line };
		let max_count = MAX_FILE_FUNCTIONS;
		let rule_id = this.warning_rule_id;
		if (file_name.is_functions_file) {
			max_count = MAX_FUNCTIONS_FILE;
			rule_id = this.functions_rule_id;
		}
		this.append_info(violations, input, max_count);
		this.append_max(violations, input, max_count, rule_id);
	}

	/** Responsibilities: _aggregation functions-file type diagnostics_. **/
	public append_type_declarations(
		violations: Violation[],
		file: string,
		file_name: LintFileNameContract,
		declarations: readonly NamedLine[],
	): void {
		if (!file_name.is_functions_file || file_name.test()) {
			return;
		}
		const rule = new DiagnosticRule('functions-file-type-declaration');
		for (const declaration of declarations) {
			violations.push(rule.violation(file, declaration.line + 1));
		}
	}
}
