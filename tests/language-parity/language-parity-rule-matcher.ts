import type { Violation } from 'src/protocols';

/** Responsibilities: _rule IDs matching_, _TypeScript Python violations comparison_. **/
export class LanguageParityRuleMatcher {
	/** Responsibilities: _reporting rule ID present_. **/
	public rule(violations: readonly Violation[], rule_id: string): boolean {
		return violations.some(violation => violation.rule_id === rule_id);
	}

	/** Responsibilities: _rule both languages comparison_. **/
	public pair(
		typescript_violations: readonly Violation[],
		python_violations: readonly Violation[],
		rule_id: string
	): boolean[] {
		return [
			this.rule(typescript_violations, rule_id),
			this.rule(python_violations, rule_id),
		];
	}
}
