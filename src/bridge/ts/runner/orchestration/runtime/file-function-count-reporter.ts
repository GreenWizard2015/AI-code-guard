import { DiagnosticRule } from 'src/model/diagnostic-rule';
import type { Violation } from 'src/protocols';
import type { FunctionCount } from 'src/types';
import type { LintFileNameContract } from 'src/types';
import { INFO_FILE_FUNCTIONS, MAX_FILE_FUNCTIONS } from 'src/constants';
import type { CountViolation, CountInput } from 'src/bridge/ts/runner/orchestration/runtime/types';

/** Responsibilities: _reporting per-file function counts_. **/
export class FileFunctionCountReporter {
	private readonly info_rule_id = 'file-function-count-info';
	private readonly warning_rule_id = 'file-function-count-warning';

	/** Responsibilities: _informational function-count diagnostics addition_. **/
	private append_info(violations: Violation[], input: CountInput): void {
if (input.count <= INFO_FILE_FUNCTIONS || input.count > MAX_FILE_FUNCTIONS) {
			return;
		}
		this.append_violation(violations, {
			...input,
			rule_id: this.info_rule_id,
			parameters: { count: String(input.count) },
		});
	}

	/** Responsibilities: _maximum function-count violations addition_. **/
	private append_max(violations: Violation[], input: CountInput): void {
		if (input.count <= MAX_FILE_FUNCTIONS) {
			return;
		}
		this.append_violation(violations, {
			...input,
			rule_id: this.warning_rule_id,
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
		this.append_info(violations, input);
		this.append_max(violations, input);
	}
}
