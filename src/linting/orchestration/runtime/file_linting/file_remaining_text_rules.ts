import { PYTHON_LANGUAGE } from "src/constants";
import type { ReexportsContract } from "src/contracts/protocols/lint_runtime_protocols";
import type { FileRemainingTextRulesContract } from "src/contracts/protocols/lint_runtime_protocols";
import { DiagnosticRule } from "src/model/diagnostic_rule";
import type { RemainingViolationOptions } from "src/model_types";
import type { RuleContract } from "src/reporting_protocols";
import { NonEnglishSourceTextRules } from "src/rules/support/non_english_source_text_rules";

/** Responsibilities: _module reexport classification_, _source text diagnostics_. **/
export class FileRemainingTextRules implements FileRemainingTextRulesContract {
	private readonly _reexports: ReexportsContract;

	/** Responsibilities: _source text diagnostics_. **/
	private append_foreign_text(options: RemainingViolationOptions, language: string): void {
		const rule: RuleContract = new DiagnosticRule("non-english-source-text");
		const text_rules = new NonEnglishSourceTextRules(rule);
		options.stage_timer.measure(`file-analysis.${language}.post-remaining.non-english-text`, () =>
			options.stage_timer.measure(`rule.non-english-source-text.${language}`, () =>
				options.violations.push(
					...text_rules.source_violations({
						file: options.file,
						text: options.text,
						language: options.source.language,
						test_file: options.source.file_name.test(),
					}),
				),
			),
		);
	}

	/** Responsibilities: _text rule dependencies initialization_. **/
	public constructor(reexports: ReexportsContract) {
		this._reexports = reexports;
	}

	/** Responsibilities: _remaining text diagnostics_. **/
	public append(options: RemainingViolationOptions): void {
		if (!options.python) {
			return;
		}
		options.stage_timer.measure(`file-analysis.${PYTHON_LANGUAGE}.post-remaining.reexports`, () =>
			options.stage_timer.measure("rule.reexports.python", () =>
				this._reexports.append_reexport_violations(options.violations, options.file, options.text, options.source),
			),
		);
		this.append_foreign_text(options, PYTHON_LANGUAGE);
	}
}
