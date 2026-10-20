import { DiagnosticRule } from "src/model/diagnostic_rule";
import type { AstResponsibilityTarget } from "src/types";
import type { RuleContract, ViolationContract } from "src/reporting_protocols";
import type { ResponsibilityLimits, ResponsibilityValues } from "src/model/types/types";
import type { ResponsibilityWordingCheckerContract } from "src/linting/orchestration/runtime/protocols";
import { ResponsibilityDocumentation } from "src/linting/orchestration/runtime/responsibility-wording/responsibility_documentation";
import { MODULE_CLASS_KIND, MODULE_INTERFACE_KIND, RESPONSIBILITIES_PREFIX } from "src/constants";

/** Responsibilities: _responsibility text parsing_, _documentation rule validation_. **/
export class ResponsibilityRules {
	private readonly rule: DiagnosticRule;
	private readonly minimum_rule: DiagnosticRule;
	private readonly maximum_rule: DiagnosticRule;
	private readonly wording_rule: DiagnosticRule;
	private readonly wording_checker: ResponsibilityWordingCheckerContract;

	/** Responsibilities: _documentation line values_. **/
	private values_for_line(line: string): ResponsibilityValues {
		const content = line.slice(RESPONSIBILITIES_PREFIX.length).trim();
		if (!content.endsWith(".")) {
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
		if (value_count > 0 && separator !== ",") {
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
		if (target.kind === MODULE_CLASS_KIND) {
			return { minimum: 2, maximum: 4 };
		}
		if (target.kind === MODULE_INTERFACE_KIND || target.kind === "record") {
			return { minimum: 1, maximum: 4 };
		}
		return { minimum: 1, maximum: 2 };
	}

	/** Responsibilities: _responsibility documentation validation_. **/
	private documentation_violations(
		file: string,
		target: AstResponsibilityTarget,
		values: ResponsibilityValues,
	): ViolationContract[] {
		if (!values.present) {
			return [this.issue(file, target, "missing a Responsibilities line", this.rule)];
		}
		if (!values.format_valid) {
			return [this.issue(file, target, "use paired underscores around each responsibility", this.rule)];
		}
		return [];
	}

	/** Responsibilities: _responsibility limits validation_. **/
	private limit_violations(
		file: string,
		target: AstResponsibilityTarget,
		values: readonly string[],
		limits: ResponsibilityLimits,
	): ViolationContract[] {
		if (values.length < limits.minimum) {
			return [this.issue(file, target, "", this.minimum_rule)];
		}
		if (values.length > limits.maximum) {
			return [this.issue(file, target, "", this.maximum_rule)];
		}
		return [];
	}

	/** Responsibilities: _responsibility contracts validation_. **/
	private target_violations(file: string, target: AstResponsibilityTarget): ViolationContract[] {
		const values = this.responsibility_values(target.documentation);
		const documentation_violations = this.documentation_violations(file, target, values);
		if (documentation_violations.length > 0) {
			return documentation_violations;
		}
		if (!this.wording_checker.valid(values.values)) {
			return [this.issue(file, target, "", this.wording_rule)];
		}
		return this.limit_violations(file, target, values.values, this.limits(target));
	}

	/** Responsibilities: _responsibility contracts validation_. **/
	private issue(file: string, target: AstResponsibilityTarget, text: string, rule: RuleContract): ViolationContract {
		return rule.violation(file, target.line + 1, {
			kind: target.kind,
			name: target.name,
			issue: text,
		});
	}

	/** Responsibilities: _responsibility wording checker injection_. **/
	public constructor(wording_checker: ResponsibilityWordingCheckerContract) {
		this.rule = new DiagnosticRule("responsibilities");
		this.minimum_rule = new DiagnosticRule("responsibilities-min-count");
		this.maximum_rule = new DiagnosticRule("responsibilities-max-count");
		this.wording_rule = new DiagnosticRule("responsibilities-wording");
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
	public collect(file: string, targets: readonly AstResponsibilityTarget[]): ViolationContract[] {
		const violations: ViolationContract[] = [];
		for (const target of targets) {
			violations.push(...this.target_violations(file, target));
		}
		return violations;
	}
}
