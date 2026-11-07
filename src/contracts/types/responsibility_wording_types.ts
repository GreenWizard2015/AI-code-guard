import type { ResponsibilityTarget } from "src/contracts/protocols/lint_runtime_protocols";
import type { ResponsibilityValues } from "src/model_types";
import type { ViolationContract } from "src/reporting_protocols";
import type { RuleContract } from "src/reporting_protocols";

/** Responsibilities: _responsibility validation diagnostic context_. **/
export type ResponsibilityViolationContext = {
	readonly file: string;
	readonly target: ResponsibilityTarget;
	readonly rule: RuleContract;
	readonly issue: string;
	readonly violations: ViolationContract[];
};

/** Responsibilities: _responsibility target validation context_. **/
export type ResponsibilityTargetContext = {
	readonly file: string;
	readonly target: ResponsibilityTarget;
	readonly violations: ViolationContract[];
};

/** Responsibilities: _responsibility count validation context_. **/

export type ResponsibilityCountContext = {
	readonly file: string;
	readonly target: ResponsibilityTarget;
	readonly violations: ViolationContract[];
	readonly values: ResponsibilityValues;
};
