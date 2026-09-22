import type { Violation } from 'src/protocols';

/** Responsibilities: _define coding-rule lint execution_. **/
export interface CodingRuleLinterContract {
	lint(): Violation[];
}

/** Responsibilities: _define responsibility wording validation_. **/
export interface ResponsibilityWordingChecker {
	valid(values: readonly string[]): boolean;
}
