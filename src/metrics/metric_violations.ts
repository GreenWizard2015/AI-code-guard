import {
	METRIC_KIND_CLASS_METHODS,
	METRIC_KIND_CLASS_SIZE,
	METRIC_KIND_FUNCTION,
	METRIC_KIND_LONG_FUNCTION,
	METRIC_KIND_LONG_METHOD,
	METRIC_KIND_METHOD,
	METRIC_KIND_SHORT_CLASS,
	METRIC_KIND_SHORT_FUNCTION,
	METRIC_KIND_SHORT_METHOD,
	METRIC_RULE_IDS,
} from "src/metrics/constants";
import { DiagnosticRule } from "src/model/diagnostic_rule";
import type { MetricViolationsContract } from "src/reporting_protocols";
import type { ViolationContract } from "src/reporting_protocols";

import type { LineDepth } from "src/model/ast/normalized_ast_types";
import type { MetricViolationKind } from "src/types";

/** Responsibilities: _metric categories rules mapping_, _metric violations creation_. **/
export class MetricViolations implements MetricViolationsContract {
	private readonly _violations: ViolationContract[];
	private readonly _file: string;

	/** Responsibilities: _attribute-depth violation creation_. **/
	private depth_violation(access: LineDepth): ViolationContract {
		const line = access.line + 1;
		const rule = new DiagnosticRule(METRIC_RULE_IDS.attribute_depth);
		return rule.violation(this._file, line, {
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

	/** Responsibilities: _metric report context initialization_. **/
	public constructor(violations: ViolationContract[], file: string) {
		this._violations = violations;
		this._file = file;
	}

	/** Responsibilities: _attribute-depth violations addition_. **/
	public append_depth_violations(accesses: readonly LineDepth[]): void {
		if (accesses.length === 0) {
			return;
		}
		const entries = accesses.map((access) => this.depth_violation(access));
		this._violations.push(...entries);
	}

	/** Responsibilities: _metric violation creation_. **/
	public metric_violation(index: number, count: number, kind: MetricViolationKind): void {
		const rule = new DiagnosticRule(this.metric_rule_id(kind));
		let callable = METRIC_KIND_FUNCTION;
		if (kind === METRIC_KIND_SHORT_METHOD || kind === METRIC_KIND_LONG_METHOD) {
			callable = METRIC_KIND_METHOD;
		}
		this._violations.push(rule.violation(this._file, index + 1, { count: String(count), callable }));
	}
}
