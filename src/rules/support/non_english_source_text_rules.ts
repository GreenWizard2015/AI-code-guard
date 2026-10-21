import type { SourceTextOccurrence } from "src/model/types/types";
import type { RuleContract, ViolationContract } from "src/reporting_protocols";
import { MarkdownProseLines } from "src/rules/support/markdown_prose_lines";
import { PythonSourceTextScanner } from "src/rules/support/python_source_text_scanner";
import { TypeScriptSourceTextScanner } from "src/rules/support/type_script_source_text_scanner";

/** Responsibilities: _non-English source text detection_, _text-file diagnostics_. **/
export class NonEnglishSourceTextRules {
	private readonly rule: RuleContract;
	private readonly non_latin_letter = /\p{L}/u;
	private readonly latin_script = /\p{Script=Latin}/u;
	/** Responsibilities: _non-Latin text detection_. **/
	private non_latin_text(text: string): boolean {
		for (const character of text) {
			if (this.non_latin_letter.test(character) && !this.latin_script.test(character)) {
				return true;
			}
		}
		return false;
	}

	/** Responsibilities: _source text violation creation_. **/
	private violations(file: string, occurrences: readonly SourceTextOccurrence[]): ViolationContract[] {
		const reported_lines = new Set<number>();
		const violations: ViolationContract[] = [];
		const ordered_occurrences = [...occurrences];
		ordered_occurrences.sort((left, right) => left.line - right.line);
		for (const occurrence of ordered_occurrences) {
			if (!this.non_latin_text(occurrence.text) || reported_lines.has(occurrence.line)) {
				continue;
			}
			reported_lines.add(occurrence.line);
			violations.push(this.rule.violation(file, occurrence.line, {}));
		}
		return violations;
	}

	/** Responsibilities: _diagnostic dependency initialization_. **/
	public constructor(rule: RuleContract) {
		this.rule = rule;
	}

	/** Responsibilities: _source code violations collection_. **/
	public source_violations(file: string, text: string, python: boolean): ViolationContract[] {
		if (!this.non_latin_text(text)) {
			return [];
		}
		if (python) {
			const scanner = new PythonSourceTextScanner();
			return this.violations(file, scanner.scan(text));
		}
		const scanner = new TypeScriptSourceTextScanner();
		return this.violations(file, scanner.scan(text));
	}

	/** Responsibilities: _text-file violations collection_. **/
	public text_file_violations(file: string, text: string): ViolationContract[] {
		const prose = new MarkdownProseLines(file, text);
		const prose_lines = prose.prose_lines();
		for (let index = 0; index < prose_lines.length; index += 1) {
			if (this.non_latin_text(prose_lines[index])) {
				return [this.rule.violation(file, index + 1, {})];
			}
		}
		return [];
	}
}
