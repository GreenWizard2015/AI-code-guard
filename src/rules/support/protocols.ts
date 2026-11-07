import type { SourceTextOccurrence } from "src/model_types";
import type { RuleContract } from "src/reporting_protocols";

/** Responsibilities: _Python quote state_. **/
export interface PythonFStringExpressionScannerContract {
	reset(): void;
	begin(): void;
	active(): boolean;
	advance(line: string, index: number): number;
}

/** Responsibilities: _Python quote state_. **/
export interface PythonQuoteTransitionsContract {
	reset(): void;
	begin_line(source_line: string): void;
	active(): boolean;
	advance_character(index: number): number;
	end_line(): void;
	string_occurrences(): readonly SourceTextOccurrence[];
}

/** Responsibilities: _module declaration policy data_. **/
export type ModuleDeclarationPolicyData = {
	readonly constants_files: ReadonlySet<string>;
	readonly type_files: ReadonlySet<string>;
	readonly protocol_files: ReadonlySet<string>;
	readonly constants_rule: RuleContract;
	readonly types_rule: RuleContract;
	readonly protocols_rule: RuleContract;
	readonly content_rule: RuleContract;
};
