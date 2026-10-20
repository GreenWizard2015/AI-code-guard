import { LanguageParityCaseRunner } from "tests/language-parity/language-parity-case-runner";
import type {
	DirectCaseContract,
	LanguageParityCaseRunnerContract,
	ProjectCaseContract,
} from "tests/language-parity/protocols";

/** Responsibilities: _delegate direct parity checks_, _delegate architecture project checks_. **/
export class LanguageParityChecker {
	private readonly case_runner: LanguageParityCaseRunnerContract;

	/** Responsibilities: _language parity checker initialization_. **/
	public constructor() {
		this.case_runner = new LanguageParityCaseRunner();
	}

	/** Responsibilities: _output direct parity results_. **/
	public direct_results(cases: readonly DirectCaseContract[]): boolean[][] {
		return this.case_runner.direct_results(cases);
	}

	/** Responsibilities: _output architecture parity results_. **/
	public architecture_results(cases: readonly DirectCaseContract[]): boolean[][] {
		return this.case_runner.architecture_results(cases);
	}

	/** Responsibilities: _output project parity results_. **/
	public project_results(cases: readonly ProjectCaseContract[]): boolean[][] {
		return this.case_runner.project_results(cases);
	}
}
