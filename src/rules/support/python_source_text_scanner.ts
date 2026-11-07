import type {
	PythonDeclarationLineScanStateData,
	PythonDeclarationStringLines,
	SourceTextOccurrence,
} from "src/model_types";
import type { PythonQuoteTransitionsContract } from "src/rules/support/protocols";
import { PythonQuoteTransitions } from "src/rules/support/python_quote_transitions";

/** Responsibilities: _Python source comments_, _Python string literals_. **/
export class PythonSourceTextScanner {
	private readonly _comment_occurrences: SourceTextOccurrence[];
	private readonly _quote_transitions: PythonQuoteTransitionsContract;
	private readonly _declaration_state: PythonDeclarationLineScanStateData;
	private readonly _annotation_lines: Set<number>;
	private readonly _export_lines: Set<number>;

	/** Responsibilities: _source line occurrence collection_. **/
	private append_source_line(source_line: string, line_index: number): void {
		this._quote_transitions.begin_line(source_line);
		let index = 0;
		while (index < source_line.length) {
			if (!this._quote_transitions.active() && source_line.charAt(index) === "#") {
				this._comment_occurrences.push({
					line: line_index + 1,
					text: source_line.slice(index),
					kind: "comment",
					column: index,
				});
				break;
			}
			index = this._quote_transitions.advance_character(index);
		}
		this._quote_transitions.end_line();
	}

	/** Responsibilities: _export delimiter depth_. **/
	private update_export_depth(delimiter_line: string): void {
		const opening = delimiter_line.match(/[([{]/gu);
		const closing = delimiter_line.match(/[)\]}]/gu);
		if (opening !== null) {
			this._declaration_state.export_depth += opening.length;
		}
		if (closing !== null) {
			this._declaration_state.export_depth -= closing.length;
		}
	}

	/** Responsibilities: _declaration state transitions_. **/
	private update_declaration_state(declaration_text: string): void {
		if (/^(async\s+)?def\s+[A-Za-z_]\w*\s*\(/u.test(declaration_text)) {
			this._declaration_state.in_signature = true;
		}
		if (/^__all__\s*(?:\+?=)/u.test(declaration_text)) {
			this._declaration_state.in_exports = true;
			this._declaration_state.export_depth = 0;
		}
	}

	/** Responsibilities: _declaration line tracking_. **/
	private observe_declaration_line(line_number: number, export_source: string, line_declaration: string): void {
		this.update_declaration_state(line_declaration);
		if (this._declaration_state.in_signature) {
			this._annotation_lines.add(line_number);
			if (line_declaration.endsWith(":")) {
				this._declaration_state.in_signature = false;
			}
		}
		if (!this._declaration_state.in_exports) {
			return;
		}
		this._export_lines.add(line_number);
		this.update_export_depth(export_source);
		this._declaration_state.in_exports = this._declaration_state.export_depth > 0;
	}

	/** Responsibilities: _quote scanner initialization_. **/
	public constructor() {
		this._comment_occurrences = [];
		this._quote_transitions = new PythonQuoteTransitions();
		this._declaration_state = { in_signature: false, in_exports: false, export_depth: 0 };
		this._annotation_lines = new Set<number>();
		this._export_lines = new Set<number>();
	}

	/** Responsibilities: _Python source scanning_. **/
	public scan(text: string): SourceTextOccurrence[] {
		return this.scan_lines(text.split("\n"));
	}

	/** Responsibilities: _Python comment scanning_. **/
	public scan_comments(text: string): SourceTextOccurrence[] {
		this.scan_lines(text.split("\n"));
		return [...this._comment_occurrences];
	}

	/** Responsibilities: _Python source line scanning_. **/
	public scan_lines(lines: readonly string[]): SourceTextOccurrence[] {
		this._comment_occurrences.length = 0;
		this._quote_transitions.reset();
		for (const [line_index, line] of lines.entries()) {
			this.append_source_line(line, line_index);
		}
		const occurrences = [...this._comment_occurrences, ...this._quote_transitions.string_occurrences()];
		occurrences.sort((left, right) => left.line - right.line);
		return occurrences;
	}

	/** Responsibilities: _declaration line indexing_. **/
	public declaration_lines(source_text: string): PythonDeclarationStringLines {
		this._declaration_state.in_signature = false;
		this._declaration_state.in_exports = false;
		this._declaration_state.export_depth = 0;
		this._annotation_lines.clear();
		this._export_lines.clear();
		for (const [index, source_line] of source_text.split("\n").entries()) {
			const line_number = index + 1;
			const declaration = source_line.trim();
			this.observe_declaration_line(line_number, source_line, declaration);
		}
		return { annotation: this._annotation_lines, exports: this._export_lines };
	}
}
