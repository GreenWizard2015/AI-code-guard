/** Responsibilities: _direct language rule case_. **/
export interface DirectCaseContract {
	readonly rule_id: string;
	readonly typescript: string;
	readonly python: string;
}

/** Responsibilities: _project language rule case_. **/
export interface ProjectCaseContract {
	readonly rule_id: string;
	readonly typescript: ReadonlyMap<string, string>;
	readonly python: ReadonlyMap<string, string>;
}

/** Responsibilities: _language parity case execution_. **/
export interface LanguageParityCaseRunnerContract {
	direct_results(cases: readonly DirectCaseContract[]): boolean[][];
	architecture_results(cases: readonly DirectCaseContract[]): boolean[][];
	project_results(cases: readonly ProjectCaseContract[]): boolean[][];
}
