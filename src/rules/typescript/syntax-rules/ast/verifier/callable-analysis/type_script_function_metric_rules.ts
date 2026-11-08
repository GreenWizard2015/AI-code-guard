import type { ASTSourceRuleContract } from "src/ast_verifier_protocols";
import { CallableMetrics } from "src/metrics/callable_metrics";
import type { AstCallableNode, NormalizedAstFile } from "src/model/ast/normalized_ast_types";
import type { ViolationContract } from "src/reporting_protocols";
import type { CallableLineMap } from "src/rules/typescript/syntax-rules/types";
import type { RuleContextContract, RuleContextState } from "src/types";
import type { TypeScriptNodeVerificationRequest } from "src/typescript_analysis_types";
import ts from "typescript";

/** Responsibilities: _callable metric analysis_, _callable line index caching_. **/
export class TypeScriptFunctionMetricRules implements ASTSourceRuleContract {
	private readonly _functions_by_line: WeakMap<ts.SourceFile, CallableLineMap>;

	/** Responsibilities: _callable line index_. **/
	private functions_by_line(source_file: ts.SourceFile, normalized_ast: NormalizedAstFile): CallableLineMap {
		const cached = this._functions_by_line.get(source_file);
		if (cached !== undefined) {
			return cached;
		}
		const functions_by_line = new Map<number, AstCallableNode[]>();
		for (const callable of normalized_ast.source.functions) {
			const callables = functions_by_line.get(callable.identity.start);
			if (callables === undefined) {
				functions_by_line.set(callable.identity.start, [callable]);
			} else {
				callables.push(callable);
			}
		}
		this._functions_by_line.set(source_file, functions_by_line);
		return functions_by_line;
	}

	/** Responsibilities: _callable names_. **/
	private callable_name(node: ts.Node, source_file: ts.SourceFile): string {
		if (ts.isFunctionDeclaration(node)) {
			const name = node.name;
			if (name === undefined) {
				return "";
			}
			return name.text;
		}
		if (ts.isVariableDeclaration(node)) {
			return node.name.getText(source_file);
		}
		return "";
	}

	/** Responsibilities: _callable metrics_. **/
	private append_callable_metrics(
		context: RuleContextContract,
		state: RuleContextState,
		callable: AstCallableNode,
	): void {
		const violations: ViolationContract[] = [];
		const metrics = new CallableMetrics(violations, state.source.file, callable, false);
		metrics.append_callable_metrics();
		for (const violation of violations) {
			context.append_violation(violation);
		}
	}

	/** Responsibilities: _function metric candidates_. **/
	private append_metrics(request: TypeScriptNodeVerificationRequest, state: RuleContextState): void {
		if (state.source.test_file) {
			return;
		}
		const { node } = request;
		const { source_file, normalized_ast } = state.source;
		const line = source_file.getLineAndCharacterOfPosition(node.getStart(source_file)).line;
		const candidates = this.functions_by_line(source_file, normalized_ast).get(line);
		if (candidates === undefined) {
			return;
		}
		const name = this.callable_name(node, source_file);
		const callable = candidates.find((candidate) => candidate.identity.name === name);
		if (callable === undefined) {
			return;
		}
		this.append_callable_metrics(request.context, state, callable);
	}

	/** Responsibilities: _function metric state_. **/
	public constructor() {
		this._functions_by_line = new WeakMap();
	}

	/** Responsibilities: _source text eligibility_. **/
	public active_for(source_code: string): boolean {
		return source_code.length > 0;
	}

	/** Responsibilities: _function metric requests_. **/
	public verify(request: TypeScriptNodeVerificationRequest): void {
		if (ts.isFunctionDeclaration(request.node) || ts.isVariableDeclaration(request.node)) {
			this.append_metrics(request, request.context.state());
		}
	}
}
