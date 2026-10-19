import {
	MAX_CALLABLE_CHARACTERS,
	MAX_CALLABLE_NESTING_DEPTH,
	MAX_FUNCTION_ARGUMENTS,
	MAX_FUNCTION_LINES,
	MIN_FUNCTION_LINES,
} from "src/constants";
import { MetricViolations } from "src/metrics/metric_violations";
import { DiagnosticRule } from "src/model/diagnostic_rule";
import type { CallableMetricNode } from "src/metrics/types";
import type { CallableMetricsContract, ViolationContract } from "src/protocols";
import type { MetricViolationKind } from "src/types";
import {
	CONSTRUCTOR_NAME,
	METRIC_KIND_LONG_FUNCTION,
	METRIC_KIND_LONG_METHOD,
	METRIC_KIND_SHORT_FUNCTION,
	METRIC_KIND_SHORT_METHOD,
	PYTHON_CONSTRUCTOR_NAME,
} from "src/metrics/constants";

/** Responsibilities: _callable size diagnostics_, _control-flow metric reporting_. **/
export class CallableMetrics implements CallableMetricsContract {
	private readonly violations: ViolationContract[];
	private readonly file: string;
	private readonly node: CallableMetricNode;
	private readonly is_method: boolean;
	private readonly characters: number;
	private readonly minimum_size: number;

	/** Responsibilities: _aggregation short long callable_. **/
	private append_length_violations(): void {
		if (this.node.name === CONSTRUCTOR_NAME || this.node.name === PYTHON_CONSTRUCTOR_NAME) {
			return;
		}
		const is_allowed = this.length_allowed();
		if (!is_allowed) {
			this.append_short_violation();
		}
		if (this.minimum_size > MAX_FUNCTION_LINES) {
			this.append_long_violation();
		}
	}

	/** Responsibilities: _classification callable length configuration_. **/
	private length_allowed(): boolean {
		if (this.node.exception_only) {
			return true;
		}
		if (this.minimum_size >= MIN_FUNCTION_LINES) {
			return true;
		}
		if (this.is_method) {
			if (this.node.visibility === "private") {
				return false;
			}
		}
		if (this.characters <= 0) {
			return false;
		}
		return this.characters <= MAX_CALLABLE_CHARACTERS;
	}

	/** Responsibilities: _aggregation short-callable violation below_. **/
	private append_short_violation(): void {
		const metric_violations = new MetricViolations();

		let kind: MetricViolationKind = METRIC_KIND_SHORT_FUNCTION;
		if (this.is_method) {
			kind = METRIC_KIND_SHORT_METHOD;
		}
		this.violations.push(metric_violations.metric_violation(this.file, this.node.start, this.minimum_size, kind));
	}

	/** Responsibilities: _aggregation long-callable violation above_. **/
	private append_long_violation(): void {
		const metric_violations = new MetricViolations();

		let kind: MetricViolationKind = METRIC_KIND_LONG_FUNCTION;
		if (this.is_method) {
			kind = METRIC_KIND_LONG_METHOD;
		}
		this.violations.push(metric_violations.metric_violation(this.file, this.node.start, this.minimum_size, kind));
	}

	/** Responsibilities: _initialization metric inputs violation_. **/
	constructor(violations: ViolationContract[], file: string, node: CallableMetricNode, is_method: boolean) {
		this.violations = violations;
		this.file = file;
		this.node = node;
		this.is_method = is_method;
		this.characters = node.characters;
		this.minimum_size = (node.lines + node.sloc) / 2;
	}

	/** Responsibilities: _reporting callable control-flow nesting_. **/
	public append_nesting_depth(): void {
		if (this.node.control_flow_depth <= MAX_CALLABLE_NESTING_DEPTH) {
			return;
		}
		const rule = new DiagnosticRule("callable-nesting-depth");
		this.violations.push(rule.violation(this.file, this.node.start + 1));
	}

	/** Responsibilities: _aggregation maximum length violations_. **/
	public append_maximum_length(): void {
		if (this.node.name === CONSTRUCTOR_NAME || this.node.name === PYTHON_CONSTRUCTOR_NAME) {
			return;
		}
		if (this.minimum_size > MAX_FUNCTION_LINES) {
			this.append_long_violation();
		}
	}

	/** Responsibilities: _aggregation callable size length_. **/
	public append_callable_metrics(): void {
		this.append_length_violations();
		this.append_nesting_depth();
		this.append_arguments();
	}

	/** Responsibilities: _aggregation argument-count violations callable_. **/
	public append_arguments(): void {
		const metric_violations = new MetricViolations();

		if (this.node.argument_count <= MAX_FUNCTION_ARGUMENTS) {
			return;
		}
		this.violations.push(
			metric_violations.metric_violation(this.file, this.node.start, this.node.argument_count, "arguments"),
		);
	}
}
