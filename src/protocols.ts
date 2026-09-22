import type ts from 'typescript';
import type { RuleParameters } from 'src/types';
import type { LintRunStatistics, LintSourceRecord } from 'src/types';
import { Violation as ViolationClass } from 'src/parser/ts/violation';
import type { ViolationOptions } from 'src/types';

/** Responsibilities: _define diagnostic violation contract_. **/
export interface Violation extends ViolationClass {
	details(): ViolationOptions;
}

/** Responsibilities: _define diagnostic rule contract_. **/
export interface Rule {
	violation(file: string, line: number, parameters: RuleParameters): Violation;
}

/** Responsibilities: _define project source statistics_. **/
export interface LintProjectContext {
	source_record(file: string): LintSourceRecord;
	files(): readonly LintSourceRecord[];
	statistics(): LintRunStatistics;
}

/** Responsibilities: _define property method owner_. **/
export interface PropertyOwnerCallbacks {
	call_owner(expression: ts.Expression, owner: string): string;
	method_owner(expression: ts.PropertyAccessExpression, owner: string): string;
}
