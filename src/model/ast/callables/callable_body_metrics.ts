import { TypeScriptStatementSloc } from "src/metrics/type_script_statement_sloc";
import { TypeScriptCallableBody } from "src/typescript-aliases/callables/type_script_callable_body";
import ts from "typescript";
import type { CallableBodyMetricsContract } from "src/runtime_protocols";

/** Responsibilities: _callable source measurement_, _control flow depth analysis_. **/
export class CallableBodyMetrics implements CallableBodyMetricsContract {
	private readonly source_file: ts.SourceFile;
	private readonly line_cache: Map<number, number>;
	private readonly character_cache: Map<number, number>;
	private readonly statement_sloc: TypeScriptStatementSloc;
	private readonly callable_body: TypeScriptCallableBody;

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
		const span = end - start;
		return span + 1;
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
		this.line_cache = new Map<number, number>();
		this.character_cache = new Map<number, number>();
		this.statement_sloc = new TypeScriptStatementSloc();
		this.callable_body = new TypeScriptCallableBody();
		this.source_file = source_file;
	}

	/** Responsibilities: _callable significant character count_. **/
	public characters(node: ts.SignatureDeclarationBase): number {
		const cached = this.character_cache.get(node.pos);
		if (cached !== undefined) {
			return cached;
		}
		const characters = this.callable_body.resolve(node, 1, (body) =>
			Math.max(1, body.getText(this.source_file).replace(/\breturn\b|[{}]/gu, "").replace(/\s+/gu, "").length),
		);
		this.character_cache.set(node.pos, characters);
		return characters;
	}

	/** Responsibilities: _callable body lines calculation_. **/
	public lines(node: ts.SignatureDeclarationBase): number {
		return this.callable_body.resolve(node, 0, (body) => this.line_count(body));
	}

	/** Responsibilities: _callable body SLOC calculation_. **/
	public sloc(node: ts.SignatureDeclarationBase): number {
		return this.callable_body.resolve(node, 1, (body) => this.sloc_count(body));
	}

	/** Responsibilities: _control-flow nesting depth calculation_. **/
	public control_flow_depth(node: ts.SignatureDeclarationBase): number {
		return this.callable_body.resolve(node, 0, (body) => {
			const controls = new Set([
				ts.SyntaxKind.IfStatement,
				ts.SyntaxKind.ForStatement,
				ts.SyntaxKind.ForInStatement,
				ts.SyntaxKind.ForOfStatement,
				ts.SyntaxKind.WhileStatement,
				ts.SyntaxKind.DoStatement,
				ts.SyntaxKind.TryStatement,
				ts.SyntaxKind.SwitchStatement,
			]);
			let maximum = 0;
			const visit = (current: ts.Node, depth: number): void => {
				if (ts.isFunctionLike(current)) {
					if (current !== node) {
						return;
					}
				}
				let next_depth = depth;
				if (controls.has(current.kind)) {
					next_depth = depth + 1;
				}
				maximum = Math.max(maximum, next_depth);
				current.forEachChild((child) => visit(child, next_depth));
			};
			visit(body, 0);
			return maximum;
		});
	}

	/** Responsibilities: _classification callable body only_. **/
	public exception_only(node: ts.SignatureDeclarationBase): boolean {
		return this.callable_body.resolve(node, false, (body) => {
			if (!ts.isBlock(body)) {
				return false;
			}
			if (body.statements.length !== 1) {
				return false;
			}
			return ts.isThrowStatement(body.statements[0]);
		});
	}
}
