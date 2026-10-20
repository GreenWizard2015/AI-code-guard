import type { MetricViolationsContract } from "src/reporting_protocols";
import type { ViolationContract } from "src/reporting_protocols";
import { DiagnosticRule } from "src/model/diagnostic_rule";
import {
	METRIC_KIND_CLASS_METHODS,
	METRIC_KIND_CLASS_SIZE,
	METRIC_KIND_LONG_FUNCTION,
	METRIC_KIND_LONG_METHOD,
	METRIC_KIND_SHORT_CLASS,
	METRIC_KIND_SHORT_FUNCTION,
	METRIC_KIND_SHORT_METHOD,
	METRIC_RULE_IDS,
	METRIC_KIND_FUNCTION,
	METRIC_KIND_METHOD,
} from "src/metrics/constants";

import type { LineDepth, MetricViolationKind } from "src/types";

/** Responsibilities: _metric categories rules mapping_, _metric violations creation_. **/
export class MetricViolations implements MetricViolationsContract {
	/** Responsibilities: _attribute-depth violation creation_. **/
	private depth_violation(file: string, access: LineDepth): ViolationContract {
		const line = access.line + 1;
		const rule = new DiagnosticRule(METRIC_RULE_IDS.attribute_depth);
		return rule.violation(file, line, {
			depth: String(access.depth),
		});
	}

	/** Responsibilities: _resolution rule ID metric_. **/
	private metric_rule_id(kind: MetricViolationKind): string {
		if (kind === METRIC_KIND_CLASS_SIZE) {
			return METRIC_RULE_IDS.class_max_size;
		}
		if (kind === METRIC_KIND_SHORT_CLASS) {
			return METRIC_RULE_IDS.class_min_size;
		}
		if (kind === METRIC_KIND_CLASS_METHODS) {
			return METRIC_RULE_IDS.class_size;
		}
		if (kind === METRIC_KIND_SHORT_FUNCTION || kind === METRIC_KIND_SHORT_METHOD) {
			return METRIC_RULE_IDS.callable_min_size;
		}
		if (kind === METRIC_KIND_LONG_FUNCTION || kind === METRIC_KIND_LONG_METHOD) {
			return METRIC_RULE_IDS.callable_max_size;
		}
		return METRIC_RULE_IDS.argument_count;
	}

	/** Responsibilities: _attribute-depth violations addition_. **/
	public append_depth_violations(violations: ViolationContract[], file: string, accesses: LineDepth[]): void {
		if (accesses.length === 0) {
			return;
		}
		const entries = accesses.map((access) => this.depth_violation(file, access));
		violations.push(...entries);
	}

	/** Responsibilities: _metric violation creation_. **/
	public metric_violation(file: string, index: number, count: number, kind: MetricViolationKind): ViolationContract {
		const rule = new DiagnosticRule(this.metric_rule_id(kind));
		let callable = METRIC_KIND_FUNCTION;
		if (kind === METRIC_KIND_SHORT_METHOD || kind === METRIC_KIND_LONG_METHOD) {
			callable = METRIC_KIND_METHOD;
		}
		return rule.violation(file, index + 1, { count: String(count), callable });
	}
}
