import { TypeScriptStatementSloc } from 'src/typescript-statement-sloc';
import ts from 'typescript';

/** Responsibilities: _calculation TypeScript callable lines_. **/
export class CallableBodyMetrics {
	private readonly source_file: ts.SourceFile;
	private readonly line_cache = new Map<number, number>();
	private readonly statement_sloc = new TypeScriptStatementSloc();

	/** Responsibilities: _source position zero-based conversion_. **/
	private source_line(position: number): number {
		const cached = this.line_cache.get(position);
		if (cached !== undefined) {
			return cached;
		}
		const line = this.source_file.getLineAndCharacterOfPosition(position).line;
		this.line_cache.set(position, line);
		return line;
	}

	/** Responsibilities: _execution metric calculation against_. **/
	private with_body<T>(
		node: ts.SignatureDeclarationBase,
		missing: T,
		present: (body: ts.Node) => T
	): T {
		if (!ts.isFunctionLike(node) || !('body' in node)) {
			return missing;
		}
		const body = node.body;
		if (body === undefined || body === null) {
			return missing;
		}
		return present(body);
	}

	/** Responsibilities: _calculation line span callable_. **/
	private line_count(body: ts.Node): number {
		if (!ts.isBlock(body)) {
			return 2;
		}
		if (body.statements.length === 0) {
			return 0;
		}
		const first = body.statements[0];
		const last = body.statements[body.statements.length - 1];
		if (first === undefined || last === undefined) {
			return 0;
		}
		const start = this.source_line(first.getStart(this.source_file));
		const end = this.source_line(last.end - 1);
		return (end - start) + 1;
	}

	/** Responsibilities: _significant source line count_. **/
	private sloc_count(body: ts.Node): number {
		if (!ts.isBlock(body)) {
			return 2;
		}
		return 1 + this.statement_sloc.statement_sloc(body);
	}

	/** Responsibilities: _initialization source file line-count_. **/
	public constructor(source_file: ts.SourceFile) {
		this.source_file = source_file;
	}

	/** Responsibilities: _source non-whitespace character count_. **/
	public significant_characters(text: string): number {
		return text.replace(/\s+/gu, '').length;
	}

	/** Responsibilities: _callable significant character count_. **/
	public characters(node: ts.SignatureDeclarationBase): number {
		return this.with_body(
			node,
			1,
			body => Math.max(1, this.significant_characters(body.getText(this.source_file).replace(/\breturn\b|[{}]/gu, '')))
		);
	}

	/** Responsibilities: _callable body lines calculation_. **/
	public lines(node: ts.SignatureDeclarationBase): number {
		return this.with_body(node, 0, body => this.line_count(body));
	}

	/** Responsibilities: _callable body SLOC calculation_. **/
	public sloc(node: ts.SignatureDeclarationBase): number {
		return this.with_body(node, 1, body => this.sloc_count(body));
	}

	/** Responsibilities: _classification callable body only_. **/
	public exception_only(node: ts.SignatureDeclarationBase): boolean {
		return this.with_body(node, false, body => {
			if (!ts.isBlock(body) || body.statements.length !== 1) {
				return false;
			}
			return ts.isThrowStatement(body.statements[0]);
		});
	}
}
