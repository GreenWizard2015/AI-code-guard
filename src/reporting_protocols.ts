import type { LintFileNameContract } from "src/source_types";
import type { RuleParameters, AstClassNode, MaxMethodMetricInput, LineDepth } from "src/types";
import type { ViolationCounts } from "src/model/types/types";

/** Responsibilities: _serialized violation data_. **/
export type ReportViolation = {
	readonly file: string;
	readonly line: number;
	readonly message: string;
	readonly hint: string;
	readonly rule_id: string;
	readonly priority: number;
};

/** Responsibilities: _violation record behavior_. **/
export interface ViolationRecordContract extends ReportViolation {
	details(): ReportViolation;
	with_line(line: number): ViolationContract;
}

/** Responsibilities: _violation priority aggregation_. **/
export interface ViolationSummaryContract {
	counts(): ViolationCounts;
	failures(): boolean;
}

/** Responsibilities: _diagnostic violation contract_. **/
export interface ViolationContract extends ViolationRecordContract {
	with_line(line: number): ViolationContract;
}

/** Responsibilities: _define diagnostic rule contract_. **/
export interface RuleContract {
	supports_file(file: string): boolean;
	violation(file: string, line: number, parameters: RuleParameters): ViolationContract;
}

/** Responsibilities: _class metric reporting_. **/
export interface ClassReportingContract {
	report_class_methods(violations: ViolationContract[], file_name: LintFileNameContract, node: AstClassNode): void;
	report_test_limits(input: MaxMethodMetricInput): void;
}

/** Responsibilities: _callable metric aggregation_. **/
export interface CallableMetricsContract {
	append_maximum_length(): void;
	append_callable_metrics(): void;
	append_nesting_depth(): void;
	append_arguments(): void;
}

/** Responsibilities: _metric violation collection_. **/
export interface MetricViolationsContract {
	append_depth_violations(violations: ViolationContract[], file: string, accesses: LineDepth[]): void;
}
