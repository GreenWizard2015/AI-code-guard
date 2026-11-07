import { RESPONSIBILITIES_PREFIX } from "src/constants";
import { MODULE_CLASS_KIND, MODULE_INTERFACE_KIND } from "src/constants";
import type { ResponsibilityWordingCheckerContract } from "src/contracts/protocols/lint_runtime_protocols";
import type { ResponsibilityTarget } from "src/contracts/protocols/lint_runtime_protocols";
import type {
	ResponsibilityCountContext,
	ResponsibilityTargetContext,
	ResponsibilityViolationContext,
} from "src/contracts/types/responsibility_wording_types";
import { DiagnosticRule } from "src/model/diagnostic_rule";
import { ResponsibilityDocumentation } from "src/model/responsibility_documentation";
import type { ResponsibilityValues } from "src/model_types";
import type { RuleContract } from "src/reporting_protocols";
import type { ViolationContract } from "src/reporting_protocols";

/** Responsibilities: _responsibility text parsing_, _documentation rule validation_. **/
export class ResponsibilityRules {
	private readonly _rule: RuleContract;
	private readonly _minimum_rule: RuleContract;
	private readonly _maximum_rule: RuleContract;
	private readonly _wording_rule: RuleContract;
	private readonly _wording_checker: ResponsibilityWordingCheckerContract;

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
		const matched_value = match[1];
		if (matched_value === undefined || !matched_value.trim()) {
			return { present: true, values: [], format_valid: false };
		}
		const value = matched_value.trim();
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
		if (values.length === 0 || body.slice(cursor).trim().length > 0) {
			return { present: true, values: [], format_valid: false };
		}
		return { present: true, values, format_valid: true };
	}

	/** Responsibilities: _responsibility violation recording_. **/
	private append_violation(context: ResponsibilityViolationContext): void {
		context.violations.push(
			context.rule.violation(context.file, context.target.line + 1, {
				kind: context.target.kind,
				name: context.target.name,
				issue: context.issue,
			}),
		);
	}

	/** Responsibilities: _responsibility count violation recording_. **/
	private append_count_violation(context: ResponsibilityCountContext): void {
		const { file, target, values, violations } = context;
		let minimum = 1;
		let maximum = 2;
		if (target.kind === MODULE_CLASS_KIND) {
			minimum = 2;
			maximum = 4;
		} else if (target.kind === MODULE_INTERFACE_KIND || target.kind === "record") {
			maximum = 4;
		}
		if (values.values.length < minimum) {
			this.append_violation({ file, target, rule: this._minimum_rule, issue: "", violations });
		} else if (values.values.length > maximum) {
			this.append_violation({ file, target, rule: this._maximum_rule, issue: "", violations });
		}
	}

	/** Responsibilities: _responsibility documentation validation_. **/
	private documented_values(context: ResponsibilityTargetContext): ResponsibilityValues {
		const documentation = new ResponsibilityDocumentation(context.target.documentation);
		const line_count = documentation.line_count();
		if (line_count !== 1) {
			const issue = line_count === 0 ? "missing a Responsibilities line" : "use exactly one Responsibilities line";
			this.append_violation({ ...context, rule: this._rule, issue });
			return { present: false, values: [], format_valid: false };
		}
		const values = this.values_for_line(documentation.line());
		if (!values.format_valid) {
			this.append_violation({
				...context,
				rule: this._rule,
				issue: "use paired underscores around each responsibility",
			});
		}
		return values;
	}

	/** Responsibilities: _responsibility target validation_. **/
	private append_target(context: ResponsibilityTargetContext): void {
		const values = this.documented_values(context);
		if (!values.present) {
			return;
		}
		if (values.values.some((value) => value.trim().split(/\s+/u).length < 2)) {
			this.append_violation({ ...context, rule: this._rule, issue: "name an explicit object for each responsibility" });
			return;
		}
		if (!this._wording_checker.valid(values.values)) {
			this.append_violation({ ...context, rule: this._wording_rule, issue: "" });
			return;
		}
		this.append_count_violation({ ...context, values });
	}

	/** Responsibilities: _responsibility wording checker injection_. **/
	public constructor(wording_checker: ResponsibilityWordingCheckerContract) {
		this._rule = new DiagnosticRule("responsibilities");
		this._minimum_rule = new DiagnosticRule("responsibilities-min-count");
		this._maximum_rule = new DiagnosticRule("responsibilities-max-count");
		this._wording_rule = new DiagnosticRule("responsibilities-wording");
		this._wording_checker = wording_checker;
	}

	/** Responsibilities: _responsibility contracts validation_. **/
	public collect_target(file: string, target: ResponsibilityTarget): ViolationContract[] {
		const violations: ViolationContract[] = [];
		this.append_target({ file, target, violations });
		return violations;
	}

	/** Responsibilities: _file responsibility contracts validation_. **/
	public collect(file: string, targets: readonly ResponsibilityTarget[]): ViolationContract[] {
		const violations: ViolationContract[] = [];
		for (const target of targets) {
			violations.push(...this.collect_target(file, target));
		}
		return violations;
	}
}
