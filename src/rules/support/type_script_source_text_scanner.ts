import type { SourceTextOccurrence } from "src/model/types/types";
import ts from "typescript";

/** Responsibilities: _TypeScript source comments_, _TypeScript string literals_. **/
export class TypeScriptSourceTextScanner {
	private readonly comment_occurrences: SourceTextOccurrence[] = [];
	private readonly string_occurrences: SourceTextOccurrence[] = [];

	/** Responsibilities: _source newline totals_. **/
	private line_breaks(text: string, start: number, end: number): number {
		let count = 0;
		for (let index = start; index < end; index += 1) {
			if (text.charAt(index) === "\n") {
				count += 1;
			}
		}
		return count;
	}

	/** Responsibilities: _token source positions_. **/
	private append_scanned_token(
		token: ts.SyntaxKind,
		scanner: ts.Scanner,
		text: string,
		position: number,
		line: number,
	): number {
		const start = scanner.getTokenPos();
		const end = scanner.getTextPos();
		let next_line = line + this.line_breaks(text, position, start);
		this.append_token(token, scanner, text, next_line);
		next_line += this.line_breaks(text, start, end);
		return next_line;
	}

	/** Responsibilities: _TypeScript token traversal_. **/
	private scan_tokens(text: string, scanner: ts.Scanner): void {
		let token = scanner.scan();
		let line = 1;
		let position = 0;
		while (token !== ts.SyntaxKind.EndOfFileToken) {
			line = this.append_scanned_token(token, scanner, text, position, line);
			position = scanner.getTextPos();
			token = scanner.scan();
		}
	}

	/** Responsibilities: _source token classification_. **/
	public append_token(token: ts.SyntaxKind, scanner: ts.Scanner, text: string, line: number): void {
		const start = scanner.getTokenPos();
		const occurrence = { line, text: text.slice(start, scanner.getTextPos()) };
		switch (token) {
			case ts.SyntaxKind.SingleLineCommentTrivia:
			case ts.SyntaxKind.MultiLineCommentTrivia:
				this.comment_occurrences.push(occurrence);
				return;
			case ts.SyntaxKind.StringLiteral:
			case ts.SyntaxKind.NoSubstitutionTemplateLiteral:
			case ts.SyntaxKind.TemplateHead:
			case ts.SyntaxKind.TemplateMiddle:
			case ts.SyntaxKind.TemplateTail:
				this.string_occurrences.push(occurrence);
				return;
			default:
				return;
		}
	}

	/** Responsibilities: _TypeScript source token scanning_. **/
	public scan(text: string): SourceTextOccurrence[] {
		this.comment_occurrences.length = 0;
		this.string_occurrences.length = 0;
		const scanner = ts.createScanner(ts.ScriptTarget.Latest, false, ts.LanguageVariant.Standard, text);
		this.scan_tokens(text, scanner);
		const occurrences = [...this.comment_occurrences, ...this.string_occurrences];
		occurrences.sort((left, right) => left.line - right.line);
		return occurrences;
	}
}
