import { PYTHON_LANGUAGE, TYPESCRIPT_LANGUAGE } from "src/constants";
import type { FileAnalysisOptions } from "src/linting/orchestration/runtime/types";
import type { ViolationContract } from "src/reporting_protocols";

/** Responsibilities: _directory diagnostics_, _remaining file diagnostics_. **/
export class FilePostAnalysis {
	private readonly _options: FileAnalysisOptions;
	private readonly _violations: ViolationContract[];

	/** Responsibilities: _post-scan inputs_. **/
	public constructor(options: FileAnalysisOptions, violations: ViolationContract[]) {
		this._options = options;
		this._violations = violations;
	}

	/** Responsibilities: _directory rule execution_. **/
	public append_directory(): void {
		const { source, stage_timer, repo_root, violation_collector } = this._options;
		let language = TYPESCRIPT_LANGUAGE;
		if (source.language === "python") {
			language = PYTHON_LANGUAGE;
		}
		stage_timer.measure(`file-analysis.${language}.post-directory`, () =>
			violation_collector.append_directory({
				violations: this._violations,
				source,
				file: source.relative_path,
				text: source.text,
				project_root: repo_root,
				stage_timer,
			}),
		);
	}

	/** Responsibilities: _remaining rule execution_. **/
	public append_remaining(): void {
		const { source, stage_timer, coding_rule_linter, violation_collector } = this._options;
		let language = TYPESCRIPT_LANGUAGE;
		if (source.language === "python") {
			language = PYTHON_LANGUAGE;
		}
		stage_timer.measure(`file-analysis.${language}.post-remaining`, () =>
			violation_collector.append_remaining_violations(
				{
					violations: this._violations,
					source,
					file: source.relative_path,
					text: source.text,
					python: source.language === "python",
					stage_timer,
				},
				coding_rule_linter,
			),
		);
	}
}
