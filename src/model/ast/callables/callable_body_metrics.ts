import { TYPE_SCRIPT_CALLABLE_BODY_KINDS } from "src/constants";
import { TypeScriptStatementSloc } from "src/metrics/type_script_statement_sloc";
import { TypeScriptCallableBody } from "src/parser/typescript-aliases/callables/type_script_callable_body";
import type { CallableBodyMetricsContract } from "src/runtime_protocols";
import ts from "typescript";

/** Responsibilities: _callable source measurement_, _control flow depth analysis_. **/
export class CallableBodyMetrics implements CallableBodyMetricsContract {
	private readonly _source_file: ts.SourceFile;
	private readonly _line_cache: Map<number, number>;
	private readonly _character_cache: Map<number, number>;
	private readonly _statement_sloc: TypeScriptStatementSloc;
	private readonly _callable_body: TypeScriptCallableBody;

	/** Responsibilities: _source position zero-based conversion_. **/
	private source_line(position: number): number {
		const cached = this._line_cache.get(position);
		if (cached !== undefined) {
			return cached;
		}
		const line = this._source_file.getLineAndCharacterOfPosition(position).line;
		this._line_cache.set(position, line);
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
		const last = body.statements.at(-1);
		if (first === undefined || last === undefined) {
			return 0;
		}
		const start = this.source_line(first.getStart(this._source_file));
		const end = this.source_line(last.end - 1);
		const span = end - start;
		return span + 1;
	}

	/** Responsibilities: _significant source line count_. **/
	private sloc_count(body: ts.Node): number {
		if (!ts.isBlock(body)) {
			return 2;
		}
		return 1 + this._statement_sloc.statement_sloc(body);
	}

	/** Responsibilities: _initialization source file line-count_. **/
	public constructor(source_file: ts.SourceFile) {
		this._line_cache = new Map<number, number>();
		this._character_cache = new Map<number, number>();
		this._statement_sloc = new TypeScriptStatementSloc();
		this._callable_body = new TypeScriptCallableBody(TYPE_SCRIPT_CALLABLE_BODY_KINDS);
		this._source_file = source_file;
	}

	/** Responsibilities: _callable significant character count_. **/
	public characters(measured_callable: ts.SignatureDeclarationBase): number {
		const cached = this._character_cache.get(measured_callable.pos);
		if (cached !== undefined) {
			return cached;
		}
		const characters = this._callable_body.resolve(measured_callable, 1, (body) =>
			Math.max(
				1,
				body
					.getText(this._source_file)
					.replace(/\breturn\b|[{}]/gu, "")
					.replace(/\s+/gu, "").length,
			),
		);
		this._character_cache.set(measured_callable.pos, characters);
		return characters;
	}

	/** Responsibilities: _callable body lines calculation_. **/
	public lines(line_callable: ts.SignatureDeclarationBase): number {
		return this._callable_body.resolve(line_callable, 0, (body) => this.line_count(body));
	}

	/** Responsibilities: _callable body SLOC calculation_. **/
	public sloc(sloc_callable: ts.SignatureDeclarationBase): number {
		return this._callable_body.resolve(sloc_callable, 1, (body) => this.sloc_count(body));
	}

	/** Responsibilities: _control-flow nesting depth calculation_. **/
	public control_flow_depth(flow_callable: ts.SignatureDeclarationBase): number {
		return this._callable_body.resolve(flow_callable, 0, (body) => {
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
				if (ts.isFunctionLike(current) && current !== flow_callable) {
					return;
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
	public exception_only(throw_callable: ts.SignatureDeclarationBase): boolean {
		return this._callable_body.resolve(throw_callable, false, (body) => {
			if (!ts.isBlock(body)) {
				return false;
			}
			if (body.statements.length !== 1) {
				return false;
			}
			const statement = body.statements.at(0);
			if (statement === undefined) {
				return false;
			}
			return ts.isThrowStatement(statement);
		});
	}
}
