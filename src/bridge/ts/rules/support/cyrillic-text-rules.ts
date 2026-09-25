import ts from 'typescript';
import { DiagnosticRule } from 'src/model/diagnostic-rule';
import type { Violation } from 'src/protocols';
import type {
	CyrillicCommentText,
	CyrillicQuoteState,
} from 'src/bridge/ts/rules/types';

/** Responsibilities: _Cyrillic text detection_. **/
export class CyrillicTextRules {
	private readonly rule = new DiagnosticRule('cyrillic-comment');
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
		comments: CyrillicCommentText[],
	): void {
		if (token !== ts.SyntaxKind.SingleLineCommentTrivia && token !== ts.SyntaxKind.MultiLineCommentTrivia) {
			return;
		}
		const start = scanner.getTokenPos();
		const end = scanner.getTextPos();
		comments.push({
			line: text.slice(0, start).split('\n').length,
			text: text.slice(start, end),
		});
	}

	/** Responsibilities: _TypeScript comment extraction_. **/
	private typescript_comments(text: string): CyrillicCommentText[] {
		const scanner = ts.createScanner(
			ts.ScriptTarget.Latest,
			false,
			ts.LanguageVariant.Standard,
			text,
		);
		const comments: CyrillicCommentText[] = [];
		let token = scanner.scan();
		while (token !== ts.SyntaxKind.EndOfFileToken) {
			this.append_typescript_comment(token, scanner, text, comments);
			token = scanner.scan();
		}
		return comments;
	}

	/** Responsibilities: _Python quote advancement_. **/
	private advance_python_quote(
		line: string,
		index: number,
		state: CyrillicQuoteState,
	): number {
		if (state.triple && line.startsWith(state.delimiter.repeat(3), index)) {
			state.active = false;
			return index + 3;
		}
		const character = line.charAt(index);
		if (!state.triple && character === '\\') {
			return index + 2;
		}
		if (!state.triple && character === state.delimiter) {
			state.active = false;
		}
		return index + 1;
	}

	/** Responsibilities: _Python quote start_. **/
	private start_python_quote(
		line: string,
		index: number,
		state: CyrillicQuoteState,
	): number {
		const character = line.charAt(index);
		if (character !== "'" && character !== '"') {
			return 0;
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
		if (line.charAt(index) !== '#') {
			return false;
		}
		comments.push({ line: line_number, text: line.slice(index) });
		return true;
	}

	/** Responsibilities: _Python line token advancement_. **/
	private advance_python_line(
		line: string,
		index: number,
		state: CyrillicQuoteState,
	): number {
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
	private python_line_comments(
		line: string,
		line_number: number,
		state: CyrillicQuoteState,
	): CyrillicCommentText[] {
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
		for (const [index, line] of text.split('\n').entries()) {
			comments.push(...this.python_line_comments(line, index + 1, state));
		}
		return comments;
	}

	/** Responsibilities: _Cyrillic violations creation_. **/
	private violations(file: string, comments: readonly CyrillicCommentText[]): Violation[] {
		const reported_lines = new Set<number>();
		const violations: Violation[] = [];
		for (const comment of comments) {
			if (!this.cyrillic_pattern.test(comment.text) || reported_lines.has(comment.line)) {
				continue;
			}
			reported_lines.add(comment.line);
			violations.push(this.rule.violation(file, comment.line));
		}
		return violations;
	}

	/** Responsibilities: _source comment violations collection_. **/
	public source_violations(file: string, text: string, python: boolean): Violation[] {
		let comments: CyrillicCommentText[];
		if (python) {
			comments = this.python_comments(text);
		} else {
			comments = this.typescript_comments(text);
		}
		return this.violations(file, comments);
	}

	/** Responsibilities: _Markdown text violations collection_. **/
	public markdown_violations(file: string, text: string): Violation[] {
		const comments = text.split('\n').map((line, index) => ({ line: index + 1, text: line }));
		const violations = this.violations(file, comments);
		return [...violations];
	}
}
