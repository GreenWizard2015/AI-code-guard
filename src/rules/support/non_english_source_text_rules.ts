import type {
	PythonDeclarationLineScanState,
	PythonDeclarationStringLines,
	SourceTextOccurrence,
} from "src/model/types/types";
import type { RuleContract, ViolationContract } from "src/reporting_protocols";
import { MarkdownProseLines } from "src/rules/support/markdown_prose_lines";
import { PythonSourceTextScanner } from "src/rules/support/python_source_text_scanner";
import { TypeScriptSourceTextScanner } from "src/rules/support/type_script_source_text_scanner";
import { TestPathSyntax } from "src/test_path_syntax";

/** Responsibilities: _non-English source text detection_, _text-file diagnostics_. **/
export class NonEnglishSourceTextRules {
	private readonly rule: RuleContract;
	private readonly test_paths: TestPathSyntax;
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

	/** Responsibilities: _Python signature line indexing_. **/
	private append_signature_line(line_number: number, trimmed: string, state: PythonDeclarationLineScanState): void {
		if (/^(async\s+)?def\s+[A-Za-z_]\w*\s*\(/u.test(trimmed)) {
			state.in_signature = true;
		}
		if (!state.in_signature) {
			return;
		}
		state.annotation_lines.add(line_number);
		if (trimmed.endsWith(":")) {
			state.in_signature = false;
		}
	}

	/** Responsibilities: _Python export line indexing_. **/
	private append_export_line(
		line_number: number,
		line: string,
		trimmed: string,
		state: PythonDeclarationLineScanState,
	): void {
		if (/^__all__\s*(?:\+?=)/u.test(trimmed)) {
			state.in_exports = true;
			state.export_depth = 0;
		}
		if (!state.in_exports) {
			return;
		}
		state.export_lines.add(line_number);
		this.update_export_depth(line, state);
		if (state.export_depth <= 0) {
			state.in_exports = false;
		}
	}

	/** Responsibilities: _Python export delimiter depth_. **/
	private update_export_depth(line: string, state: PythonDeclarationLineScanState): void {
		const opening = line.match(/[([{]/gu);
		const closing = line.match(/[)\]}]/gu);
		if (opening !== null) {
			state.export_depth += opening.length;
		}
		if (closing !== null) {
			state.export_depth -= closing.length;
		}
	}

	/** Responsibilities: _Python declaration metadata_. **/
	private python_declaration_lines(text: string): PythonDeclarationStringLines {
		const state: PythonDeclarationLineScanState = {
			in_signature: false,
			in_exports: false,
			export_depth: 0,
			annotation_lines: new Set<number>(),
			export_lines: new Set<number>(),
		};
		for (const [index, line] of text.split("\n").entries()) {
			const line_number = index + 1;
			const trimmed = line.trim();
			this.append_signature_line(line_number, trimmed, state);
			this.append_export_line(line_number, line, trimmed, state);
		}
		return { annotation: state.annotation_lines, exports: state.export_lines };
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
	private python_source_violations(file: string, text: string): ViolationContract[] {
		const scanner = new PythonSourceTextScanner();
		if (this.test_paths.test_file(file)) {
			return this.violations(file, scanner.scan_comments(text));
		}
		const declaration_lines = this.python_declaration_lines(text);
		const lines = text.split("\n");
		const occurrences = scanner
			.scan(text)
			.filter(
				(occurrence) =>
					occurrence.kind !== "string" ||
					(!declaration_lines.exports.has(occurrence.line) &&
						!this.python_annotation_string(occurrence, lines, declaration_lines.annotation)),
			);
		return this.violations(file, occurrences);
	}

	/** Responsibilities: _TypeScript source violations_. **/
	private typescript_source_violations(file: string, text: string): ViolationContract[] {
		const scanner = new TypeScriptSourceTextScanner();
		if (this.test_paths.test_file(file)) {
			return this.violations(file, scanner.scan_comments(text));
		}
		return this.violations(file, scanner.scan(text));
	}

	/** Responsibilities: _diagnostic dependency initialization_. **/
	public constructor(rule: RuleContract) {
		this.rule = rule;
		this.test_paths = new TestPathSyntax();
	}

	/** Responsibilities: _source code violations collection_. **/
	public source_violations(file: string, text: string, python: boolean): ViolationContract[] {
		if (!this.non_latin_text(text)) {
			return [];
		}
		if (python) {
			return this.python_source_violations(file, text);
		}
		return this.typescript_source_violations(file, text);
	}

	/** Responsibilities: _text-file violations collection_. **/
	public text_file_violations(file: string, text: string): ViolationContract[] {
		const markdown_prose = new MarkdownProseLines(file, text);
		const prose_lines = markdown_prose.prose_lines();
		for (let index = 0; index < prose_lines.length; index += 1) {
			if (this.non_latin_text(prose_lines[index])) {
				return [this.rule.violation(file, index + 1, {})];
			}
		}
		return [];
	}
}
