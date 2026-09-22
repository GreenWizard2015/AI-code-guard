import type { Violation } from 'src/protocols';
import { DiagnosticRule } from 'src/model/diagnostic-rule';

import type { LineDepth, MetricViolationKind } from 'src/types';

/** Responsibilities: _metric categories rules mapping_, _metric violations creation_. **/
export class MetricViolations {
	public readonly MAX_ATTRIBUTE_DEPTH = 4;

	/** Responsibilities: _attribute-depth violation creation_. **/
	private depth_violation(file: string, access: LineDepth): Violation {
		const line = access.line + 1;
		const rule = new DiagnosticRule('attribute-depth');
		return rule.violation(file, line, {
			depth: String(access.depth),
		});
	}

	/** Responsibilities: _resolution rule ID metric_. **/
	private metric_rule_id(kind: MetricViolationKind): string {
		if (kind === 'class_size') {
			return 'class-max-size';
		}
		if (kind === 'short_class') {
			return 'class-min-size';
		}
		if (kind === 'class_methods') {
			return 'class-size';
		}
		if (kind === 'short_function' || kind === 'short_method') {
			return 'callable-min-size';
		}
		if (kind === 'long_function' || kind === 'long_method') {
			return 'callable-max-size';
		}
		return 'argument-count';
	}

	/** Responsibilities: _attribute-depth violations addition_. **/
	public append_depth_violations(
		violations: Violation[],
		file: string,
		accesses: LineDepth[]
	): void {
		if (accesses.length === 0) {
			return;
		}
		const entries = accesses.map(access => this.depth_violation(file, access));
		violations.push(...entries);
	}

	/** Responsibilities: _metric violation creation_. **/
	public metric_violation(
		file: string,
		index: number,
		count: number,
		kind: MetricViolationKind
	): Violation {
		const rule = new DiagnosticRule(this.metric_rule_id(kind));
		const callable = kind === 'short_method' || kind === 'long_method' ? 'method' : 'function';
		return rule.violation(file, index + 1, { count: String(count), callable });
	}
}
