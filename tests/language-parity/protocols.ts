/** Responsibilities: _direct language rule case_. **/
export type DirectCase = {
	readonly rule_id: string;
	readonly typescript: string;
	readonly python: string;
};

/** Responsibilities: _project language rule case_. **/
export type ProjectCase = {
	readonly rule_id: string;
	readonly typescript: ReadonlyMap<string, string>;
	readonly python: ReadonlyMap<string, string>;
};

/** Responsibilities: _language parity case execution_. **/
export interface LanguageParityCaseRunnerContract {
	direct_results(cases: readonly DirectCase[]): boolean[][];
	architecture_results(cases: readonly DirectCase[]): boolean[][];
	project_results(cases: readonly ProjectCase[]): boolean[][];
}
