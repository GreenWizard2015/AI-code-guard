import type { PythonQuoteState, QuoteCompletionContract, SourceTextOccurrence } from "src/model/types/types";
import { PythonFStringExpressionScanner } from "src/rules/support/python_f_string_expression_scanner";

/** Responsibilities: _Python source comments_, _Python string literals_. **/
export class PythonSourceTextScanner {
	private readonly comment_occurrences: SourceTextOccurrence[] = [];
	private readonly string_occurrences: SourceTextOccurrence[] = [];
	private readonly f_string_expression: PythonFStringExpressionScanner;

	/** Responsibilities: _Python quote advancement_. **/
	private advance_quote(line: string, index: number, state: PythonQuoteState): number {
		const character = line.charAt(index);
		if (state.triple) {
			if (line.startsWith(state.delimiter.repeat(3), index)) {
				state.active = false;
				return index + 3;
			}
			return index + 1;
		}
		switch (character) {
			case "\\":
				return index + 2;
			case state.delimiter:
				state.active = false;
				return index + 1;
			default:
				return index + 1;
		}
	}

	/** Responsibilities: _quote prefix recognition_. **/
	private quote_prefix(line: string, index: number): string {
		let prefix_start = index;
		while (prefix_start > 0 && index - prefix_start < 2 && /[rRuUbBfF]/u.test(line.charAt(prefix_start - 1))) {
			prefix_start -= 1;
		}
		if (/[A-Za-z0-9_]/u.test(line.charAt(prefix_start - 1))) {
			return "";
		}
		return line.slice(prefix_start, index).toLowerCase();
	}

	/** Responsibilities: _quote delimiter recognition_. **/
	private start_quote(line: string, index: number, state: PythonQuoteState): number {
		const character = line.charAt(index);
		if (character !== "'" && character !== '"') {
			return 0;
		}
		state.active = true;
		state.delimiter = character;
		state.triple = line.startsWith(character.repeat(3), index);
		state.formatted = this.quote_prefix(line, index).includes("f");
		this.f_string_expression.reset();
		if (state.triple) {
			return 3;
		}
		return 1;
	}

	/** Responsibilities: _Python literal text collection_. **/
	private append_literal(parts: string[], line_number: number, column: number): void {
		const text = parts.join("");
		if (text.length > 0) {
			this.string_occurrences.push({ line: line_number, text, kind: "string", column });
		}
		parts.length = 0;
	}

	/** Responsibilities: _f-string expression entry_. **/
	private formatted_expression_start(line: string, index: number, parts: string[]): number {
		if (line.startsWith("{{", index)) {
			parts.push("{{");
			return index + 2;
		}
		if (line.charAt(index) === "{") {
			this.f_string_expression.begin();
			return index + 1;
		}
		return index;
	}

	/** Responsibilities: _Python literal completion_. **/
	private finish_quote(options: QuoteCompletionContract): number {
		if (!options.state.active) {
			this.append_literal(options.parts, options.line_number, options.state.literal_column);
			options.state.formatted = false;
			return options.next;
		}
		options.parts.push(options.line.slice(options.index, options.next));
		return options.next;
	}

	/** Responsibilities: _active Python quote scanning_. **/
	private active_quote(
		line: string,
		index: number,
		state: PythonQuoteState,
		parts: string[],
		line_number: number,
	): number {
		if (this.f_string_expression.active()) {
			return this.f_string_expression.advance(line, index);
		}
		if (state.formatted) {
			const expression_index = this.formatted_expression_start(line, index, parts);
			if (expression_index !== index) {
				return expression_index;
			}
		}
		const next = this.advance_quote(line, index, state);
		return this.finish_quote({ line, index, next, state, parts, line_number });
	}

	/** Responsibilities: _Python line character scanning_. **/
	private scan_character(
		line: string,
		index: number,
		line_number: number,
		state: PythonQuoteState,
		parts: string[],
	): number {
		if (state.active) {
			return this.active_quote(line, index, state, parts, line_number);
		}
		if (line.charAt(index) === "#") {
			this.comment_occurrences.push({ line: line_number, text: line.slice(index), kind: "comment", column: index });
			return line.length;
		}
		const quote_length = this.start_quote(line, index, state);
		if (quote_length > 0) {
			state.literal_column = index;
			return index + quote_length;
		}
		return index + 1;
	}

	/** Responsibilities: _Python source line scanning_. **/
	private scan_line(line: string, line_number: number, state: PythonQuoteState): void {
		const parts: string[] = [];
		if (state.active) {
			state.literal_column = 0;
		}
		let index = 0;
		while (index < line.length) {
			index = this.scan_character(line, index, line_number, state, parts);
		}
		if (state.active) {
			this.append_literal(parts, line_number, state.literal_column);
		}
	}

	/** Responsibilities: _f-string scanner initialization_. **/
	public constructor() {
		this.f_string_expression = new PythonFStringExpressionScanner();
	}

	/** Responsibilities: _Python source text scanning_. **/
	public scan(text: string): SourceTextOccurrence[] {
		const lines = text.split("\n");
		return this.scan_lines(lines);
	}

	/** Responsibilities: _Python comment scanning_. **/
	public scan_comments(text: string): SourceTextOccurrence[] {
		this.scan_lines(text.split("\n"));
		return [...this.comment_occurrences];
	}

	/** Responsibilities: _Python source line scanning_. **/
	public scan_lines(lines: readonly string[]): SourceTextOccurrence[] {
		this.comment_occurrences.length = 0;
		this.string_occurrences.length = 0;
		const state: PythonQuoteState = {
			active: false,
			delimiter: "'",
			triple: false,
			formatted: false,
			literal_column: 0,
		};
		for (const [index, line] of lines.entries()) {
			this.scan_line(line, index + 1, state);
		}
		const occurrences = [...this.comment_occurrences, ...this.string_occurrences];
		occurrences.sort((left, right) => left.line - right.line);
		return occurrences;
	}
}
