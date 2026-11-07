import {
	MAX_CALLABLE_CHARACTERS,
	MAX_CALLABLE_NESTING_DEPTH,
	MAX_FUNCTION_ARGUMENTS,
	MAX_FUNCTION_LINES,
	MIN_FUNCTION_LINES,
} from "src/constants";
import {
	CONSTRUCTOR_NAME,
	METRIC_KIND_LONG_FUNCTION,
	METRIC_KIND_LONG_METHOD,
	METRIC_KIND_SHORT_FUNCTION,
	METRIC_KIND_SHORT_METHOD,
	PYTHON_CONSTRUCTOR_NAME,
} from "src/metrics/constants";
import { MetricViolations } from "src/metrics/metric_violations";
import type { AstCallableNode } from "src/model/ast/normalized_ast_types";
import { DiagnosticRule } from "src/model/diagnostic_rule";
import type { CallableMetricsContract, MetricViolationsContract } from "src/reporting_protocols";
import type { ViolationContract } from "src/reporting_protocols";
import type { MetricViolationKind } from "src/types";

/** Responsibilities: _callable size diagnostics_, _control-flow metric reporting_. **/
export class CallableMetrics implements CallableMetricsContract {
	private readonly _violations: ViolationContract[];
	private readonly _file: string;
	private readonly _node: AstCallableNode;
	private readonly _is_method: boolean;
	private readonly _characters: number;
	private readonly _minimum_size: number;
	private readonly _metric_violations: MetricViolationsContract;

	/** Responsibilities: _aggregation short long callable_. **/
	private append_length_violations(): void {
		if (this._node.identity.name === CONSTRUCTOR_NAME || this._node.identity.name === PYTHON_CONSTRUCTOR_NAME) {
			return;
		}
		const is_allowed = this.length_allowed();
		if (!is_allowed) {
			this.append_short_violation();
		}
		if (this._minimum_size > MAX_FUNCTION_LINES) {
			this.append_long_violation();
		}
	}

	/** Responsibilities: _classification callable length configuration_. **/
	private length_allowed(): boolean {
		if (this._node.test_behavior.exception_only) {
			return true;
		}
		if (this._minimum_size >= MIN_FUNCTION_LINES) {
			return true;
		}
		if (this._is_method && this._node.identity.visibility === "private") {
			return false;
		}
		if (this._characters <= 0) {
			return false;
		}
		return this._characters <= MAX_CALLABLE_CHARACTERS;
	}

	/** Responsibilities: _aggregation short-callable violation below_. **/
	private append_short_violation(): void {
		let kind: MetricViolationKind = METRIC_KIND_SHORT_FUNCTION;
		if (this._is_method) {
			kind = METRIC_KIND_SHORT_METHOD;
		}
		this._metric_violations.metric_violation(this._node.identity.start, this._minimum_size, kind);
	}

	/** Responsibilities: _aggregation long-callable violation above_. **/
	private append_long_violation(): void {
		let kind: MetricViolationKind = METRIC_KIND_LONG_FUNCTION;
		if (this._is_method) {
			kind = METRIC_KIND_LONG_METHOD;
		}
		this._metric_violations.metric_violation(this._node.identity.start, this._minimum_size, kind);
	}

	/** Responsibilities: _initialization metric inputs violation_. **/
	public constructor(violations: ViolationContract[], file: string, node: AstCallableNode, is_method: boolean) {
		this._violations = violations;
		this._file = file;
		this._node = node;
		this._is_method = is_method;
		this._metric_violations = new MetricViolations(violations, file);
		this._characters = node.metrics.characters;
		this._minimum_size = (node.metrics.lines + node.metrics.sloc) / 2;
	}

	/** Responsibilities: _reporting callable control-flow nesting_. **/
	public append_nesting_depth(): void {
		if (this._node.metrics.control_flow_depth <= MAX_CALLABLE_NESTING_DEPTH) {
			return;
		}
		const rule = new DiagnosticRule("callable-nesting-depth");
		this._violations.push(rule.violation(this._file, this._node.identity.start + 1));
	}

	/** Responsibilities: _aggregation maximum length violations_. **/
	public append_maximum_length(): void {
		if (this._node.identity.name === CONSTRUCTOR_NAME || this._node.identity.name === PYTHON_CONSTRUCTOR_NAME) {
			return;
		}
		if (this._minimum_size > MAX_FUNCTION_LINES) {
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
		if (this._node.metrics.argument_count <= MAX_FUNCTION_ARGUMENTS) {
			return;
		}
		this._metric_violations.metric_violation(this._node.identity.start, this._node.metrics.argument_count, "arguments");
	}
}
