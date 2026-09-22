import type { DirectCase, ProjectCase } from 'tests/language-parity/types';
import { LanguageParityCaseRunner } from 'tests/language-parity/language-parity-case-runner';

/** Responsibilities: _delegate direct parity checks_, _delegate architecture project checks_. **/
export class LanguageParityChecker {
	private readonly case_runner = new LanguageParityCaseRunner();

	/** Responsibilities: _output direct parity results_. **/
	public direct_results(cases: readonly DirectCase[]): boolean[][] {
		return this.case_runner.direct_results(cases);
	}

	/** Responsibilities: _output architecture parity results_. **/
	public architecture_results(cases: readonly DirectCase[]): boolean[][] {
		return this.case_runner.architecture_results(cases);
	}

	/** Responsibilities: _output project parity results_. **/
	public project_results(cases: readonly ProjectCase[]): boolean[][] {
		return this.case_runner.project_results(cases);
	}
}
