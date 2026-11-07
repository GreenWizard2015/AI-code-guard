import type { LineDepth } from "src/model/ast/normalized_ast_types";
import type { ViolationCounts } from "src/model_types";
import type { MetricViolationKind, RuleParameters } from "src/types";

/** Responsibilities: _violation record data_. **/
export interface ViolationContract {
	/** Responsibilities: _source file access_. **/
	file(): string;
	/** Responsibilities: _diagnostic line access_. **/
	line(): number;
	/** Responsibilities: _diagnostic message access_. **/
	message(): string;
	/** Responsibilities: _diagnostic hint access_. **/
	hint(): string;
	/** Responsibilities: _rule identifier access_. **/
	rule_id(): string;
	/** Responsibilities: _diagnostic priority access_. **/
	priority(): number;
}

/** Responsibilities: _report path comparison_. **/
export interface TaskViolationPathContract {
	same_file_as(candidate: TaskViolationPathContract): boolean;
	descendant_of(directory: TaskViolationPathContract): boolean;
	matches_absolute_path(candidate: string): boolean;
	contains_descendant_path(candidate: string): boolean;
}

/** Responsibilities: _serialized violation data_. **/
export type ReportViolationOptions = {
	readonly file: string;
	readonly line: number;
	readonly message: string;
	readonly hint: string;
	readonly rule_id: string;
	readonly priority: number;
};

/** Responsibilities: _violation priority aggregation_. **/
export interface ViolationSummaryContract {
	counts(): ViolationCounts;
	failures(): boolean;
}

/** Responsibilities: _define diagnostic rule contract_. **/
export interface RuleContract {
	supports_file(file: string): boolean;
	violation(file: string, line: number, parameters: RuleParameters): ViolationContract;
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
	append_depth_violations(accesses: readonly LineDepth[]): void;
	metric_violation(index: number, count: number, kind: MetricViolationKind): void;
}
