import type { ProxyRulesContract } from "src/analysis_protocols";
import type { ASTSourceRuleContract } from "src/ast_verifier_protocols";
import { RULE_IDS } from "src/linting/constants";
import type { RuleContextContract } from "src/types";
import type { TypeScriptNodeVerificationRequest } from "src/typescript_analysis_types";
import ts from "typescript";

/** Responsibilities: _context-scoped syntax rules_, _proxy diagnostic reporting_. **/
export class TypeScriptContextNodeVerifier implements ASTSourceRuleContract {
	private readonly _proxy_rules: ProxyRulesContract;

	/** Responsibilities: _callable proxy classification_. **/
	private append_callable_proxy(node: ts.FunctionLikeDeclaration, context: RuleContextContract): void {
		context.state().analysis.stage_timer.measure(`rule.${RULE_IDS.proxy_callable}`, () => {
			if (context.state().source.test_file) {
				return;
			}
			if (this._proxy_rules.proxy_callable(node)) {
				context.for_node(node).append_rule(RULE_IDS.proxy_callable);
			}
		});
	}

	/** Responsibilities: _lambda proxy classification_. **/
	private append_lambda_proxy(node: ts.FunctionLikeDeclaration, context: RuleContextContract): void {
		context.state().analysis.stage_timer.measure(`rule.${RULE_IDS.proxy_lambda}`, () => {
			if (context.state().source.test_file) {
				return;
			}
			if (this._proxy_rules.proxy_lambda(node)) {
				context.for_node(node).append_rule(RULE_IDS.proxy_lambda);
			}
		});
	}

	/** Responsibilities: _context verifier dependencies_. **/
	public constructor(proxy_rules: ProxyRulesContract) {
		this._proxy_rules = proxy_rules;
	}

	/** Responsibilities: _context verifier source activation_. **/
	public active_for(source_code: string): boolean {
		return source_code.length > 0;
	}

	/** Responsibilities: _context node rule evaluation_. **/
	public verify(request: TypeScriptNodeVerificationRequest): void {
		const { node, context } = request;
		if (node.kind === ts.SyntaxKind.TupleType) {
			context
				.state()
				.analysis.stage_timer.measure(`rule.${RULE_IDS.tuple_type}`, () =>
					context.for_node(node).append_rule(RULE_IDS.tuple_type),
				);
			return;
		}
		if (ts.isFunctionDeclaration(node) || ts.isMethodDeclaration(node)) {
			this.append_callable_proxy(node, context);
			return;
		}
		if (ts.isArrowFunction(node) || ts.isFunctionExpression(node)) {
			this.append_lambda_proxy(node, context);
		}
	}
}
