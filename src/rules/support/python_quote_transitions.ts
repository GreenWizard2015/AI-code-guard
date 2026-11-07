import type { PythonSourceTextScanState, SourceTextOccurrence } from "src/model_types";
import type {
	PythonFStringExpressionScannerContract,
	PythonQuoteTransitionsContract,
} from "src/rules/support/protocols";
import { PythonFStringExpressionScanner } from "src/rules/support/python_f_string_expression_scanner";

/** Responsibilities: _quote state_, _expression boundary state_. **/
export class PythonQuoteTransitions implements PythonQuoteTransitionsContract {
	private readonly _state: PythonSourceTextScanState;
	private readonly _expressions: PythonFStringExpressionScannerContract;
	private readonly _literals: SourceTextOccurrence[];

	/** Responsibilities: _triple-quoted string advancement_. **/
	private advance_triple_quote(): number {
		const { line, index, delimiter } = this._state;
		if (line.startsWith(delimiter.repeat(3), index)) {
			this._state.active = false;
			return index + 3;
		}
		return index + 1;
	}

	/** Responsibilities: _single-quoted string advancement_. **/
	private advance_single_quote(character: string): number {
		const { index, delimiter } = this._state;
		switch (character) {
			case "\\":
				return index + 2;
			case delimiter: {
				this._state.active = false;
				return index + 1;
			}
			default:
				return index + 1;
		}
	}

	/** Responsibilities: _Python quote advancement_. **/
	private advance_quote(): number {
		const { line, index } = this._state;
		if (this._state.triple) {
			return this.advance_triple_quote();
		}
		return this.advance_single_quote(line.charAt(index));
	}

	/** Responsibilities: _quote prefix recognition_. **/
	private quote_prefix(): string {
		const { line, index } = this._state;
		let prefix_start = index;
		while (prefix_start > 0 && index - prefix_start < 2 && /[rRuUbBfF]/u.test(line.charAt(prefix_start - 1))) {
			prefix_start -= 1;
		}
		if (/[A-Za-z0-9_]/u.test(line.charAt(prefix_start - 1))) {
			return "";
		}
		return line.slice(prefix_start, index).toLowerCase();
	}

	/** Responsibilities: _f-string expression entry_. **/
	private formatted_expression_start(): number {
		const { line, index, parts } = this._state;
		if (line.startsWith("{{", index)) {
			parts.push("{{");
			return index + 2;
		}
		if (line.charAt(index) === "{") {
			this._expressions.begin();
			return index + 1;
		}
		return index;
	}

	/** Responsibilities: _quote delimiter recognition_. **/
	private start_quote(): number {
		const { line, index } = this._state;
		const character = line.charAt(index);
		if (character !== "'" && character !== '"') {
			return 0;
		}
		this._state.active = true;
		this._state.delimiter = character;
		this._state.triple = line.startsWith(character.repeat(3), index);
		this._state.formatted = this.quote_prefix().includes("f");
		this._expressions.reset();
		return this._state.triple ? 3 : 1;
	}

	/** Responsibilities: _active quote advancement_. **/
	private active_quote(): number {
		const { line, index } = this._state;
		if (this._expressions.active()) {
			return this._expressions.advance(line, index);
		}
		if (this._state.formatted) {
			const expression_index = this.formatted_expression_start();
			if (expression_index !== index) {
				return expression_index;
			}
		}
		return this.advance_quote();
	}

	/** Responsibilities: _literal text collection_. **/
	private append_literal(column: number): void {
		const { line_number, parts } = this._state;
		const text = parts.join("");
		if (text.length > 0) {
			this._literals.push({ line: line_number, text, kind: "string", column });
		}
		parts.splice(0);
	}

	/** Responsibilities: _literal segment completion_. **/
	private finish_quote(next: number): number {
		const { line, index, parts } = this._state;
		if (!this._state.active) {
			this.append_literal(this._state.literal_column);
			this._state.formatted = false;
			return next;
		}
		parts.push(line.slice(index, next));
		return next;
	}

	/** Responsibilities: _active quote character advancement_. **/
	private active_character(active_index: number): number {
		if (this._expressions.active()) {
			return this._expressions.advance(this._state.line, active_index);
		}
		const next = this.active_quote();
		if (this._expressions.active()) {
			return next;
		}
		return this.finish_quote(next);
	}

	/** Responsibilities: _outside quote character advancement_. **/
	private outside_character(source_index: number): number {
		const quote_length = this.start_quote();
		if (quote_length === 0) {
			return source_index + 1;
		}
		this._state.literal_column = source_index;
		return source_index + quote_length;
	}

	/** Responsibilities: _quote state initialization_. **/
	public constructor() {
		this._literals = [];
		this._expressions = new PythonFStringExpressionScanner();
		this._state = {
			line: "",
			line_number: 0,
			index: 0,
			parts: [],
			active: false,
			delimiter: "'",
			triple: false,
			formatted: false,
			literal_column: 0,
		};
	}

	/** Responsibilities: _quote scan reset_. **/
	public reset(): void {
		this._literals.length = 0;
		this._state.line_number = 0;
		this._state.active = false;
		this._state.formatted = false;
		this._expressions.reset();
	}

	/** Responsibilities: _source line initialization_. **/
	public begin_line(source_line: string): void {
		this._state.line = source_line;
		this._state.line_number += 1;
		this._state.parts.length = 0;
		this._state.index = 0;
		if (this._state.active) {
			this._state.literal_column = 0;
		}
	}

	/** Responsibilities: _quote state access_. **/
	public active(): boolean {
		return this._state.active;
	}

	/** Responsibilities: _source character advancement_. **/
	public advance_character(character_index: number): number {
		this._state.index = character_index;
		if (this._state.active) {
			return this.active_character(character_index);
		}
		return this.outside_character(character_index);
	}

	/** Responsibilities: _unterminated quote recording_. **/
	public end_line(): void {
		if (this._state.active) {
			this.append_literal(this._state.literal_column);
		}
	}

	/** Responsibilities: _literal occurrence collection_. **/
	public string_occurrences(): readonly SourceTextOccurrence[] {
		return this._literals;
	}
}
