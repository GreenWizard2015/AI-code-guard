import type { SourceTextOccurrence } from "src/model_types";
import type { PythonQuoteTransitionsContract } from "src/rules/support/protocols";
import { PythonQuoteTransitions } from "src/rules/support/python_source_text/python_quote_transitions";

/** Responsibilities: _Python source comments_, _Python string literals_. **/
export class PythonSourceTextScanner {
	private readonly _comment_occurrences: SourceTextOccurrence[];
	private readonly _quote_transitions: PythonQuoteTransitionsContract;

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

	/** Responsibilities: _quote scanner initialization_. **/
	public constructor() {
		this._comment_occurrences = [];
		this._quote_transitions = new PythonQuoteTransitions();
	}

	/** Responsibilities: _Python source scanning_. **/
	public scan(text: string): SourceTextOccurrence[] {
		return this.scan_lines(text.split("\n"));
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
}
