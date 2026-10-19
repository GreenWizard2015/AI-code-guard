import { CyrillicTextRules } from "src/rules/support/cyrillic_text_rules";
import { DiagnosticRule } from "src/model/diagnostic_rule";
import type { ReexportsContract } from "src/linting/orchestration/runtime/protocols";
import type { RuleContract } from "src/protocols";
import type { RemainingViolationOptions } from "src/model/types/types";
import { PYTHON_LANGUAGE, TYPESCRIPT_LANGUAGE } from "src/constants";

/** Responsibilities: _reexport_, _source text_ diagnostics_. **/
export class FileRemainingTextRules {
	private readonly reexports: ReexportsContract;

	/** Responsibilities: _source text diagnostics_. **/
	private append_cyrillic(options: RemainingViolationOptions, language: string): void {
		const cyrillic_rule: RuleContract = new DiagnosticRule("cyrillic-comment");
		const cyrillic_text_rules = new CyrillicTextRules(cyrillic_rule);
		options.stage_timer.measure(`file-analysis.${language}.post-remaining.cyrillic`, () =>
			options.violations.push(
				...cyrillic_text_rules.source_violations(options.file, options.text, options.python),
			),
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
			this.reexports.append_reexport_violations(
				options.violations,
				options.file,
				options.text,
				options.source,
			),
		);
	}

	/** Responsibilities: _remaining text diagnostics_. **/
	public append(options: RemainingViolationOptions): void {
		this.append_reexports(options);
		let language = TYPESCRIPT_LANGUAGE;
		if (options.python) {
			language = PYTHON_LANGUAGE;
		}
		this.append_cyrillic(options, language);
	}

}
