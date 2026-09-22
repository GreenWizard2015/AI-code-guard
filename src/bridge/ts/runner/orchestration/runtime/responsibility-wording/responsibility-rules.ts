import { DiagnosticRule } from 'src/model/diagnostic-rule';
import type { AstResponsibilityTarget } from 'src/types';
import type { Violation } from 'src/protocols';
import type { ResponsibilityLimits, ResponsibilityValues } from 'src/bridge/ts/runner/orchestration/runtime/types';
import type { ResponsibilityWordingChecker } from 'src/bridge/ts/runner/orchestration/runtime/protocols';
import { ResponsibilityDocumentation } from 'src/bridge/ts/runner/orchestration/runtime/responsibility-wording/responsibility-documentation';

/** Responsibilities: _responsibility rule collection_. **/
export class ResponsibilityRules {
	private readonly rule = new DiagnosticRule('responsibilities');
	private readonly minimum_rule = new DiagnosticRule('responsibilities-min-count');
	private readonly maximum_rule = new DiagnosticRule('responsibilities-max-count');
	private readonly wording_rule = new DiagnosticRule('responsibilities-wording');
	private readonly wording_checker: ResponsibilityWordingChecker;

	/** Responsibilities: _documentation line values_. **/
	private values_for_line(line: string): ResponsibilityValues {
		const content = line.slice('Responsibilities:'.length).trim();
		if (!content.endsWith('.')) {
			return { present: true, values: [], format_valid: false };
		}
		const body = content.slice(0, -1).trim();
		return this.values_from_pattern(body, /_(.*?)_(?=\s*(?:,|$))/gu);
	}

	/** Responsibilities: _value match resolution_. **/
	private value_for_match(
		body: string,
		match: RegExpExecArray,
		value_count: number,
		cursor: number,
	): ResponsibilityValues {
		const separator = body.slice(cursor, match.index).trim();
		if (value_count > 0 && separator !== ',') {
			return { present: true, values: [], format_valid: false };
		}
		if (value_count === 0 && separator.length > 0) {
			return { present: true, values: [], format_valid: false };
		}
		const value = match[1]?.trim();
		if (!value) {
			return { present: true, values: [], format_valid: false };
		}
		return { present: true, values: [value], format_valid: true };
	}

	/** Responsibilities: _pattern value collection_. **/
	private values_from_pattern(body: string, value_pattern: RegExp): ResponsibilityValues {
		const values: string[] = [];
		let cursor = 0;
		let match = value_pattern.exec(body);
		while (match !== null) {
			const value = this.value_for_match(body, match, values.length, cursor);
			if (!value.format_valid) {
				return value;
			}
			values.push(...value.values);
			cursor = value_pattern.lastIndex;
			match = value_pattern.exec(body);
		}
		return this.completed_values(body, values, cursor);
	}

	/** Responsibilities: _completed values validation_. **/
	private completed_values(body: string, values: string[], cursor: number): ResponsibilityValues {
		if (values.length === 0 || body.slice(cursor).trim().length > 0) {
			return { present: true, values: [], format_valid: false };
		}
		return { present: true, values, format_valid: true };
	}

	/** Responsibilities: _responsibility contracts validation_. **/
	private limits(target: AstResponsibilityTarget): ResponsibilityLimits {
		if (target.kind === 'class' || target.kind === 'interface') {
			return { minimum: 1, maximum: 4 };
		}
		return { minimum: 1, maximum: 2 };
	}

	/** Responsibilities: _responsibility documentation validation_. **/
	private documentation_violations(
		file: string,
		target: AstResponsibilityTarget,
		values: ResponsibilityValues,
	): Violation[] {
		if (!values.present) {
			return [this.issue(file, target, 'missing a Responsibilities line', this.rule)];
		}
		if (!values.format_valid) {
			return [this.issue(file, target, 'use paired underscores around each responsibility', this.rule)];
		}
		return [];
	}

	/** Responsibilities: _responsibility limits validation_. **/
	private limit_violations(
		file: string,
		target: AstResponsibilityTarget,
		values: readonly string[],
		limits: ResponsibilityLimits,
	): Violation[] {
		if (values.length < limits.minimum) {
			return [this.issue(file, target, '', this.minimum_rule)];
		}
		if (values.length > limits.maximum) {
			return [this.issue(file, target, '', this.maximum_rule)];
		}
		return [];
	}

	/** Responsibilities: _responsibility contracts validation_. **/
	private target_violations(
		file: string,
		target: AstResponsibilityTarget,
	): Violation[] {
		const values = this.responsibility_values(target.documentation);
		const documentation_violations = this.documentation_violations(file, target, values);
		if (documentation_violations.length > 0) {
			return documentation_violations;
		}
		if (!this.wording_checker.valid(values.values)) {
			return [this.issue(file, target, '', this.wording_rule)];
		}
		return this.limit_violations(file, target, values.values, this.limits(target));
	}

	/** Responsibilities: _responsibility contracts validation_. **/
	private issue(
		file: string,
		target: AstResponsibilityTarget,
		text: string,
		rule: DiagnosticRule,
	): Violation {
		return rule.violation(file, target.line + 1, {
			kind: target.kind,
			name: target.name,
			issue: text,
		});
	}

	/** Responsibilities: _responsibility wording checker injection_. **/
	public constructor(wording_checker: ResponsibilityWordingChecker) {
		this.wording_checker = wording_checker;
	}

	/** Responsibilities: _responsibility values extraction_. **/
	public responsibility_values(documentation: string): ResponsibilityValues {
		const documentation_access = new ResponsibilityDocumentation(documentation);
		if (!documentation_access.present()) {
			return { present: false, values: [], format_valid: false };
		}
		return this.values_for_line(documentation_access.line());
	}

	/** Responsibilities: _responsibility contracts validation_. **/
	public collect(file: string, targets: readonly AstResponsibilityTarget[]): Violation[] {
		const violations: Violation[] = [];
		for (const target of targets) {
			violations.push(...this.target_violations(file, target));
		}
		return violations;
	}
}
