import { StandaloneStringComments } from "src/rules/support/standalone_string_comments";
import { MarkdownProseLines } from "src/rules/support/markdown_prose_lines";
import type { CyrillicCommentText, CyrillicQuoteState } from "src/model/types/types";
import type { RuleContract, ViolationContract } from "src/reporting_protocols";
import ts from "typescript";

/** Responsibilities: _Cyrillic text_, _comment diagnostics_. **/
export class CyrillicTextRules {
	private readonly rule: RuleContract;
	private readonly cyrillic_pattern = /[\u0400-\u04ff]/u;
	private readonly empty_quote: CyrillicQuoteState = {
		active: false,
		delimiter: "'",
		triple: false,
	};

	/** Responsibilities: _TypeScript comment recording_. **/
	private append_typescript_comment(
		token: ts.SyntaxKind,
		scanner: ts.Scanner,
		text: string,
		line: number,
		comments: CyrillicCommentText[],
	): void {
		if (token === ts.SyntaxKind.SingleLineCommentTrivia) {
			// Continue with comment recording below.
		} else if (token !== ts.SyntaxKind.MultiLineCommentTrivia) {
			return;
		}
		const start = scanner.getTokenPos();
		const end = scanner.getTextPos();
		comments.push({
			line,
			text: text.slice(start, end),
		});
	}

	/** Responsibilities: _line break count_. **/
	private line_breaks(text: string, start: number, end: number): number {
		let count = 0;
		for (let index = start; index < end; index += 1) {
			if (text.charAt(index) === "\n") {
				count += 1;
			}
		}
		return count;
	}

	/** Responsibilities: _TypeScript comment extraction_. **/
	private typescript_comments(text: string): CyrillicCommentText[] {
		const scanner = ts.createScanner(ts.ScriptTarget.Latest, false, ts.LanguageVariant.Standard, text);
		const comments: CyrillicCommentText[] = [];
		let token = scanner.scan();
		let line = 1;
		let position = 0;
		while (token !== ts.SyntaxKind.EndOfFileToken) {
			const start = scanner.getTokenPos();
			const end = scanner.getTextPos();
			line += this.line_breaks(text, position, start);
			this.append_typescript_comment(token, scanner, text, line, comments);
			line += this.line_breaks(text, start, end);
			position = end;
			token = scanner.scan();
		}
		return comments;
	}

	/** Responsibilities: _Python quote advancement_. **/
	private advance_python_quote(line: string, index: number, state: CyrillicQuoteState): number {
		if (state.triple) {
			if (line.startsWith(state.delimiter.repeat(3), index)) {
				state.active = false;
				return index + 3;
			}
		}
		const character = line.charAt(index);
		if (state.triple) {
			return index + 1;
		}
		if (character === "\\") {
			return index + 2;
		}
		if (character === state.delimiter) {
			state.active = false;
		}
		return index + 1;
	}

	/** Responsibilities: _Python quote start_. **/
	private start_python_quote(line: string, index: number, state: CyrillicQuoteState): number {
		const character = line.charAt(index);
		if (character !== "'") {
			if (character !== '"') {
				return 0;
			}
		}
		state.active = true;
		state.delimiter = character;
		state.triple = line.startsWith(character.repeat(3), index);
		if (state.triple) {
			return 3;
		}
		return 1;
	}

	/** Responsibilities: _Python comment recording_. **/
	private append_python_comment(
		line: string,
		line_number: number,
		index: number,
		comments: CyrillicCommentText[],
	): boolean {
		if (line.charAt(index) !== "#") {
			return false;
		}
		comments.push({ line: line_number, text: line.slice(index) });
		return true;
	}

	/** Responsibilities: _Python line token advancement_. **/
	private advance_python_line(line: string, index: number, state: CyrillicQuoteState): number {
		if (state.active) {
			return this.advance_python_quote(line, index, state);
		}
		const quote_length = this.start_python_quote(line, index, state);
		if (quote_length > 0) {
			return index + quote_length;
		}
		return index + 1;
	}

	/** Responsibilities: _Python comment line scanning_. **/
	private python_line_comments(line: string, line_number: number, state: CyrillicQuoteState): CyrillicCommentText[] {
		const comments: CyrillicCommentText[] = [];
		let index = 0;
		while (index < line.length) {
			if (!state.active && this.append_python_comment(line, line_number, index, comments)) {
				break;
			}
			index = this.advance_python_line(line, index, state);
		}
		return comments;
	}

	/** Responsibilities: _Python comment extraction_. **/
	private python_comments(text: string): CyrillicCommentText[] {
		const comments: CyrillicCommentText[] = [];
		const state = { ...this.empty_quote };
		for (const [index, line] of text.split("\n").entries()) {
			comments.push(...this.python_line_comments(line, index + 1, state));
		}
		return comments;
	}

	/** Responsibilities: _Cyrillic violations creation_. **/
	private violations(file: string, comments: readonly CyrillicCommentText[]): ViolationContract[] {
		const reported_lines = new Set<number>();
		const violations: ViolationContract[] = [];
		for (const comment of comments) {
			if (!this.cyrillic_pattern.test(comment.text) || reported_lines.has(comment.line)) {
				continue;
			}
			reported_lines.add(comment.line);
			violations.push(this.rule.violation(file, comment.line, {}));
		}
		return violations;
	}

	/** Responsibilities: _diagnostic dependency initialization_. **/
	public constructor(rule: RuleContract) {
		this.rule = rule;
	}

	/** Responsibilities: _source comment violations collection_. **/
	public source_violations(file: string, text: string, python: boolean): ViolationContract[] {
		if (!python && !this.cyrillic_pattern.test(text)) {
			return [];
		}
		let comments: CyrillicCommentText[];
		const standalone_strings = new StandaloneStringComments(text);
		if (python) {
			comments = [...this.python_comments(text), ...standalone_strings.python_comments()];
		} else {
			comments = [...this.typescript_comments(text), ...standalone_strings.typescript_comments()];
		}
		return this.violations(file, comments);
	}

	/** Responsibilities: _text file violations collection_. **/
	public text_file_violations(file: string, text: string): ViolationContract[] {
		const markdown_document = new MarkdownProseLines(file, text);
		const lines = markdown_document.prose_lines();
		for (let index = 0; index < lines.length; index += 1) {
			if (this.cyrillic_pattern.test(lines[index])) {
				return [this.rule.violation(file, index + 1, {})];
			}
		}
		return [];
	}
}
