import { MetricViolations } from 'src/metric-violations';
import type { Violation } from 'src/protocols';
import {
	MAX_CALLABLE_CHARACTERS,
	MAX_FUNCTION_ARGUMENTS,
	MAX_FUNCTION_LINES,
	MIN_FUNCTION_LINES,
} from 'src/constants';
import type { CallableMetricNode } from 'src/metrics/types';
import type { MetricViolationKind } from 'src/types';


/** Responsibilities: _reporting callable length SLOC_. **/
export class CallableMetrics {
	private readonly violations: Violation[];
	private readonly file: string;
	private readonly node: CallableMetricNode;
	private readonly is_method: boolean;
	private readonly characters: number;
	private readonly minimum_size: number;

	/** Responsibilities: _aggregation short long callable_. **/
	private append_length_violations(): void {
if (this.node.name === 'constructor' || this.node.name === '__init__') {
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
		if (this.node.exception_only === true) {
			return true;
		}
		if (this.minimum_size >= MIN_FUNCTION_LINES) {
			return true;
		}
		if (this.is_method && this.node.visibility === 'private') {
			return false;
		}
		if (this.characters <= 0) {
			return false;
		}
		return this.characters <= MAX_CALLABLE_CHARACTERS;
	}

	/** Responsibilities: _aggregation short-callable violation below_. **/
	private append_short_violation(): void {
		const metric_violations = new MetricViolations();

		let kind: MetricViolationKind = 'short_function';
		if (this.is_method) {
			kind = 'short_method';
		}
		this.violations.push(metric_violations.metric_violation(this.file, this.node.start, this.minimum_size, kind));
	}

	/** Responsibilities: _aggregation long-callable violation above_. **/
	private append_long_violation(): void {
		const metric_violations = new MetricViolations();

		let kind: MetricViolationKind = 'long_function';
		if (this.is_method) {
			kind = 'long_method';
		}
		this.violations.push(metric_violations.metric_violation(this.file, this.node.start, this.minimum_size, kind));
	}

	/** Responsibilities: _initialization metric inputs violation_. **/
	constructor(violations: Violation[], file: string, node: CallableMetricNode, is_method: boolean) {
		this.violations = violations;
		this.file = file;
		this.node = node;
		this.is_method = is_method;
		this.characters = node.characters;
		this.minimum_size = (node.lines + node.sloc) / 2;
	}

	/** Responsibilities: _aggregation maximum length violations_. **/
	public append_maximum_length(): void {
if (this.node.name === 'constructor' || this.node.name === '__init__') {
			return;
		}
		if (this.minimum_size > MAX_FUNCTION_LINES) {
			this.append_long_violation();
		}
	}

	/** Responsibilities: _aggregation callable size length_. **/
	public append_callable_metrics(): void {
		this.append_length_violations();
		this.append_arguments();
	}

	/** Responsibilities: _aggregation argument-count violations callable_. **/
	public append_arguments(): void {
		const metric_violations = new MetricViolations();

		if (this.node.argument_count <= MAX_FUNCTION_ARGUMENTS) {
			return;
		}
		this.violations.push(
			metric_violations.metric_violation(this.file, this.node.start, this.node.argument_count, 'arguments')
		);
	}
}
