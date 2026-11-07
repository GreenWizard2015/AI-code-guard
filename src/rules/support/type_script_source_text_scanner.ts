import type { SourceTextOccurrence } from "src/model_types";
import ts from "typescript";

/** Responsibilities: _TypeScript source comments_, _TypeScript string literals_. **/
export class TypeScriptSourceTextScanner {
	private readonly _source_text: string;

	/** Responsibilities: _source newline totals_. **/
	private line_breaks(start: number, end: number): number {
		let count = 0;
		let line_break = this._source_text.indexOf("\n", start);
		while (line_break >= 0 && line_break < end) {
			count += 1;
			line_break = this._source_text.indexOf("\n", line_break + 1);
		}
		return count;
	}

	/** Responsibilities: _token source positions_. **/
	private append_scanned_token(
		token: ts.SyntaxKind,
		token_scanner: ts.Scanner,
		position: number,
		line: number,
		occurrences: SourceTextOccurrence[],
	): number {
		const start = token_scanner.getTokenPos();
		const end = token_scanner.getTextPos();
		let next_line = line + this.line_breaks(position, start);
		this.append_token(token, token_scanner, next_line, occurrences);
		next_line += this.line_breaks(start, end);
		return next_line;
	}

	/** Responsibilities: _TypeScript token traversal_. **/
	private scan_tokens(scanner_state: ts.Scanner): SourceTextOccurrence[] {
		const occurrences: SourceTextOccurrence[] = [];
		let token = scanner_state.scan();
		let line = 1;
		let position = 0;
		while (token !== ts.SyntaxKind.EndOfFileToken) {
			line = this.append_scanned_token(token, scanner_state, position, line, occurrences);
			position = scanner_state.getTextPos();
			token = scanner_state.scan();
		}
		return occurrences;
	}

	/** Responsibilities: _source token classification_. **/
	private append_token(
		token: ts.SyntaxKind,
		token_scanner: ts.Scanner,
		line: number,
		occurrences: SourceTextOccurrence[],
	): void {
		const start = token_scanner.getTokenPos();
		const end = token_scanner.getTextPos();
		const column = start - this._source_text.lastIndexOf("\n", start - 1) - 1;
		switch (token) {
			case ts.SyntaxKind.SingleLineCommentTrivia:
			case ts.SyntaxKind.MultiLineCommentTrivia: {
				occurrences.push({ line, text: this._source_text.slice(start, end), kind: "comment", column });
				return;
			}
			case ts.SyntaxKind.StringLiteral:
			case ts.SyntaxKind.NoSubstitutionTemplateLiteral:
			case ts.SyntaxKind.TemplateHead:
			case ts.SyntaxKind.TemplateMiddle:
			case ts.SyntaxKind.TemplateTail: {
				occurrences.push({ line, text: this._source_text.slice(start, end), kind: "string", column });
				return;
			}
			default:
				return;
		}
	}

	/** Responsibilities: _TypeScript scanner source ownership_. **/
	public constructor(source_text: string) {
		this._source_text = source_text;
	}

	/** Responsibilities: _TypeScript source token scanning_. **/
	public scan(): SourceTextOccurrence[] {
		if (this._source_text.length === 0) {
			return [];
		}
		const scanner = ts.createScanner(ts.ScriptTarget.Latest, false, ts.LanguageVariant.Standard, this._source_text);
		const occurrences = this.scan_tokens(scanner);
		occurrences.sort((left, right) => left.line - right.line);
		return occurrences;
	}

	/** Responsibilities: _TypeScript comment scanning_. **/
	public scan_comments(): SourceTextOccurrence[] {
		return this.scan().filter((occurrence) => occurrence.kind === "comment");
	}
}
