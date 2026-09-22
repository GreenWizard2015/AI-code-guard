import type { Violation } from 'src/protocols';

/** Responsibilities: _define TypeScript rule-group execution_. **/
export interface TypeScriptRuleGroupContract {
	append(violations: Violation[]): void;
}
