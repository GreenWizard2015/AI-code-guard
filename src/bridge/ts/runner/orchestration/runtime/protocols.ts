import type { Violation } from 'src/protocols';
import ts from 'typescript';

/** Responsibilities: _define coding-rule lint execution_. **/
export interface CodingRuleLinterContract {
	lint(): Violation[];
}

/** Responsibilities: _define responsibility wording validation_. **/
export interface ResponsibilityWordingChecker {
	valid(values: readonly string[]): boolean;
}

	/** Responsibilities: _factory source contract_. **/
export interface FactoryObjectSourcesContract {
	values(): Map<string, ts.ObjectLiteralExpression>;
	append(
		expression: ts.Expression,
		visitor: (source: ts.ObjectLiteralExpression) => void,
	): void;
}
