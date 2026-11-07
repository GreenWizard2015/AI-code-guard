import type { SourceTextAnalysisOptions, SourceTextOccurrence } from "src/model_types";
import type { RuleContract } from "src/reporting_protocols";
import type { ViolationContract } from "src/reporting_protocols";
import { MarkdownProseLines } from "src/rules/support/markdown_prose_lines";
import { PythonSourceTextScanner } from "src/rules/support/python_source_text_scanner";
import { TypeScriptSourceTextScanner } from "src/rules/support/type_script_source_text_scanner";
import type { NonEnglishSourceTextRulesContract } from "src/shared_services_protocols";

/** Responsibilities: _non-English source text detection_, _text-file diagnostics_. **/
export class NonEnglishSourceTextRules implements NonEnglishSourceTextRulesContract {
	private readonly _rule: RuleContract;
	private readonly _non_latin_letter: RegExp;
	private readonly _latin_script: RegExp;
	private readonly _non_ascii_character: RegExp;
	/** Responsibilities: _non-Latin text detection_. **/
	private non_latin_text(source_text: string): boolean {
		if (!this._non_ascii_character.test(source_text)) {
			return false;
		}
		for (const character of source_text) {
			if (this._non_latin_letter.test(character) && !this._latin_script.test(character)) {
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
			violations.push(this._rule.violation(file, occurrence.line, {}));
		}
		return violations;
	}

	/** Responsibilities: _Python string annotation classification_. **/
	private python_annotation_string(
		occurrence: SourceTextOccurrence,
		lines: readonly string[],
		annotation_lines: ReadonlySet<number>,
	): boolean {
		if (!annotation_lines.has(occurrence.line)) {
			return false;
		}
		const line = lines[occurrence.line - 1];
		if (line === undefined) {
			return false;
		}
		const prefix = line.slice(0, occurrence.column);
		const previous_assignment = prefix.lastIndexOf("=");
		const annotation_separator = Math.max(prefix.lastIndexOf(":"), prefix.lastIndexOf("->"));
		return annotation_separator > previous_assignment;
	}

	/** Responsibilities: _Python source violations_. **/
	private python_source_violations(python_options: SourceTextAnalysisOptions): ViolationContract[] {
		const scanner = new PythonSourceTextScanner();
		if (python_options.test_file) {
			return this.violations(python_options.file, scanner.scan_comments(python_options.text));
		}
		const declaration_lines = scanner.declaration_lines(python_options.text);
		const lines = python_options.text.split("\n");
		const occurrences = scanner
			.scan(python_options.text)
			.filter(
				(occurrence) =>
					occurrence.kind !== "string" ||
					(!declaration_lines.exports.has(occurrence.line) &&
						!this.python_annotation_string(occurrence, lines, declaration_lines.annotation)),
			);
		return this.violations(python_options.file, occurrences);
	}

	/** Responsibilities: _TypeScript source violations_. **/
	private typescript_source_violations(typescript_options: SourceTextAnalysisOptions): ViolationContract[] {
		const scanner = new TypeScriptSourceTextScanner(typescript_options.text);
		if (typescript_options.test_file) {
			return this.violations(typescript_options.file, scanner.scan_comments());
		}
		return this.violations(typescript_options.file, scanner.scan());
	}

	/** Responsibilities: _explicit localized-document ownership_. **/
	private declared_localized_prose(document_text: string): boolean {
		const lines = document_text.split("\n");
		const first_line = lines[0];
		if (first_line === undefined || first_line.trim() !== "---") {
			return false;
		}
		for (const line of lines.slice(1)) {
			const value = line.trim();
			if (value === "---") {
				return false;
			}
			if (!/^language:\s*[a-z]{2,3}(?:-[A-Z]{2})?$/u.test(value)) {
				continue;
			}
			return value.slice(value.indexOf(":") + 1).trim() !== "en";
		}
		return false;
	}

	/** Responsibilities: _diagnostic dependency initialization_. **/
	public constructor(rule: RuleContract) {
		this._rule = rule;
		this._non_latin_letter = /\p{L}/u;
		this._latin_script = /\p{Script=Latin}/u;
		this._non_ascii_character = /[^\p{ASCII}]/u;
	}

	/** Responsibilities: _source code violations collection_. **/
	public source_violations(source_options: SourceTextAnalysisOptions): ViolationContract[] {
		if (!this.non_latin_text(source_options.text)) {
			return [];
		}
		if (source_options.language === "python") {
			return this.python_source_violations(source_options);
		}
		return this.typescript_source_violations(source_options);
	}

	/** Responsibilities: _text-file violations collection_. **/
	public text_file_violations(document_file: string, document_text: string): ViolationContract[] {
		if (this.declared_localized_prose(document_text)) {
			return [];
		}
		const markdown_prose = new MarkdownProseLines(document_file, document_text);
		const prose_lines = markdown_prose.prose_lines();
		for (let index = 0; index < prose_lines.length; index += 1) {
			const prose_line = prose_lines[index];
			if (prose_line !== undefined && this.non_latin_text(prose_line)) {
				return [this._rule.violation(document_file, index + 1, {})];
			}
		}
		return [];
	}
}
