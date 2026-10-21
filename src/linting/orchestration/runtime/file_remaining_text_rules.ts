import { NonEnglishSourceTextRules } from "src/rules/support/non_english_source_text_rules";
import { DiagnosticRule } from "src/model/diagnostic_rule";
import type { ReexportsContract } from "src/linting/orchestration/runtime/protocols";
import type { RuleContract } from "src/reporting_protocols";
import type { RemainingViolationOptions } from "src/model/types/types";
import { PYTHON_LANGUAGE, TYPESCRIPT_LANGUAGE } from "src/constants";

/** Responsibilities: _reexport_, _source text_ diagnostics_. **/
export class FileRemainingTextRules {
	private readonly reexports: ReexportsContract;

	/** Responsibilities: _source text diagnostics_. **/
	private append_foreign_text(options: RemainingViolationOptions, language: string): void {
		const rule: RuleContract = new DiagnosticRule("non-english-source-text");
		const text_rules = new NonEnglishSourceTextRules(rule);
		options.stage_timer.measure(`file-analysis.${language}.post-remaining.non-english-text`, () =>
			options.violations.push(...text_rules.source_violations(options.file, options.text, options.python)),
		);
	}

	/** Responsibilities: _text rule dependencies initialization_. **/
	public constructor(reexports: ReexportsContract) {
		this.reexports = reexports;
	}

	/** Responsibilities: _reexport diagnostics_. **/
	public append_reexports(options: RemainingViolationOptions): void {
		let language = TYPESCRIPT_LANGUAGE;
		if (options.python) {
			language = PYTHON_LANGUAGE;
		}
		options.stage_timer.measure(`file-analysis.${language}.post-remaining.reexports`, () =>
			this.reexports.append_reexport_violations(options.violations, options.file, options.text, options.source),
		);
	}

	/** Responsibilities: _remaining text diagnostics_. **/
	public append(options: RemainingViolationOptions): void {
		this.append_reexports(options);
		let language = TYPESCRIPT_LANGUAGE;
		if (options.python) {
			language = PYTHON_LANGUAGE;
		}
		this.append_foreign_text(options, language);
	}
}
