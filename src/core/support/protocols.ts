import type { DocumentationExampleSourceFiles } from "documentation_validation/types";
import type { LintReportMode, LintReportOptions } from "src/core/types";
import type { AstLanguage } from "src/model/ast/normalized_ast_types";
import type { LintExecutionReport } from "src/runtime_types";

/** Responsibilities: _file path identity_, _file role classification_. **/
export interface LintFileNameContract {
	value(): string;
	functions_file(): boolean;
	test(): boolean;
	product(): boolean;
	language(): AstLanguage;
}

/** Responsibilities: _project path relationship_, _directory membership_. **/
export interface ProjectPathRelationContract {
	inside_root(): boolean;
	path(): string;
	strictly_nested(): boolean;
	contains_any_directory(names: ReadonlySet<string>): boolean;
}

/** Responsibilities: _documentation example lint execution_. **/
export interface DocumentationExampleLintConfigurationContract {
	lint_report(options: LintReportOptions, mode: LintReportMode): LintExecutionReport;
}

/** Responsibilities: _documentation example execution inputs_. **/
export type DocumentationExampleRunOptions = {
	readonly repo_root: string;
	readonly source_path: string;
	readonly rule_id: string;
	readonly source_files: DocumentationExampleSourceFiles;
	readonly configuration: DocumentationExampleLintConfigurationContract;
};
