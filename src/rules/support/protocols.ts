import type { SourceTextOccurrence } from "src/model_types";
import type { AstLanguage, NormalizedAstFile } from "src/model/ast/normalized_ast_types";
import type { RuleContract } from "src/reporting_protocols";
import type { LintSourceRecordData } from "src/source_types";

export type CodeCategoryCounts = Map<string, number>;
export type CodeCategoryTotals = Map<string, CodeCategoryCounts>;

/** Responsibilities: _source category inventory_. **/
export interface CodeCategoryIndexContract {
	index_sources(sources: readonly LintSourceRecordData[]): void;
	category_is_unique(file: string, ast: NormalizedAstFile, language: AstLanguage, text: string): boolean;
}

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
