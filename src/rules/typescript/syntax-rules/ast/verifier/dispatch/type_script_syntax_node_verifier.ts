import type { UnnecessaryUndefinedCheckContract } from "src/analysis_protocols";
import type { ASTSourceRuleContract } from "src/ast_verifier_protocols";
import { RULE_IDS } from "src/linting/constants";
import type { RuleContract } from "src/reporting_protocols";
import { UnnecessaryUndefinedCheck } from "src/rules/typescript/syntax-rules/runtime/unnecessary_undefined_check";
import type { CallableRuleAppender, RuleContextContract } from "src/types";
import type { TypeScriptCallExpressionInspectorContract } from "src/typescript_analysis_protocols";
import type { TypeScriptNodeRuntimeRulesData } from "src/typescript_analysis_protocols";
import type { TypeScriptNodeVerificationRequest } from "src/typescript_analysis_types";
import ts from "typescript";

/** Responsibilities: _syntax node classification_, _syntax diagnostic reporting_. **/
export class TypeScriptSyntaxNodeVerifier implements ASTSourceRuleContract {
	private readonly _runtime_rules: TypeScriptNodeRuntimeRulesData;
	private readonly _type_guard_rule: RuleContract;
	private readonly _bind_rule: RuleContract;
	private readonly _call_expression_inspector: TypeScriptCallExpressionInspectorContract;
	private readonly _undefined_checks: WeakMap<RuleContextContract, UnnecessaryUndefinedCheckContract>;
	private readonly _type_guard_kinds: ReadonlySet<ts.SyntaxKind>;

	/** Responsibilities: _undefined-check lifecycle_. **/
	private undefined_check(context: RuleContextContract): UnnecessaryUndefinedCheckContract {
		const cached = this._undefined_checks.get(context);
		if (cached !== undefined) {
			return cached;
		}
		const state = context.state();
		const append_rule: CallableRuleAppender = (node, rule_id): void => {
			context.for_node(node).append_rule(rule_id);
		};
		const checker = new UnnecessaryUndefinedCheck(
			state.source.source_file,
			append_rule,
			state.analysis.source_resolver,
			state.analysis.module_resolver,
			state.analysis.source_index,
		);
		this._undefined_checks.set(context, checker);
		return checker;
	}

	/** Responsibilities: _type predicate candidate selection_. **/
	private matches_type_guard(node: ts.Node): boolean {
		if (!this._type_guard_kinds.has(node.kind)) {
			return false;
		}
		if (!ts.isFunctionLike(node)) {
			return false;
		}
		const predicate = node.type;
		if (predicate === undefined) {
			return false;
		}
		return predicate.kind === ts.SyntaxKind.TypePredicate;
	}

	/** Responsibilities: _runtime syntax diagnostics_. **/
	private append_semantic_diagnostics(request: TypeScriptNodeVerificationRequest): void {
		const { node, context } = request;
		if (ts.isNewExpression(node)) {
			const imports = this._runtime_rules.platform_api.module_namespace_imports();
			if (imports.dependency(node)) {
				context.for_node(node).append_rule(RULE_IDS.module_namespace_dependency);
			}
		}
		if (ts.isCallExpression(node)) {
			const is_bind_call = this._call_expression_inspector.bind_call(node);
			if (is_bind_call) {
				context.for_node(node).append_diagnostic_rule(this._bind_rule);
			}
		}
		if (this.matches_type_guard(node)) {
			context.for_node(node).append_diagnostic_rule(this._type_guard_rule);
		}
	}

	/** Responsibilities: _syntax verifier initialization_. **/
	public constructor(
		runtime_rules: TypeScriptNodeRuntimeRulesData,
		type_guard_rule: RuleContract,
		bind_rule: RuleContract,
		call_expression_inspector: TypeScriptCallExpressionInspectorContract,
	) {
		this._runtime_rules = runtime_rules;
		this._type_guard_rule = type_guard_rule;
		this._bind_rule = bind_rule;
		this._call_expression_inspector = call_expression_inspector;
		this._undefined_checks = new WeakMap();
		this._type_guard_kinds = new Set([
			ts.SyntaxKind.GetAccessor,
			ts.SyntaxKind.SetAccessor,
			ts.SyntaxKind.Constructor,
			ts.SyntaxKind.MethodDeclaration,
			ts.SyntaxKind.FunctionDeclaration,
			ts.SyntaxKind.ArrowFunction,
			ts.SyntaxKind.FunctionExpression,
			ts.SyntaxKind.MethodSignature,
			ts.SyntaxKind.CallSignature,
			ts.SyntaxKind.JSDocSignature,
			ts.SyntaxKind.ConstructSignature,
			ts.SyntaxKind.JSDocFunctionType,
			ts.SyntaxKind.ConstructorType,
		]);
	}

	/** Responsibilities: _source applicability_. **/
	public active_for(source_code: string): boolean {
		return source_code.length > 0;
	}

	/** Responsibilities: _syntax rule evaluation_. **/
	public verify(request: TypeScriptNodeVerificationRequest): void {
		const { node, context } = request;
		switch (node.kind) {
			case ts.SyntaxKind.SourceFile:
			case ts.SyntaxKind.BinaryExpression:
			case ts.SyntaxKind.PropertyAccessExpression:
			case ts.SyntaxKind.ElementAccessExpression: {
				this.undefined_check(context).append(node);
				if (node.kind === ts.SyntaxKind.BinaryExpression) {
					this._runtime_rules.test_node_rules.append_rules(node, context);
				}
				break;
			}
			case ts.SyntaxKind.CallExpression:
				this._runtime_rules.test_node_rules.append_rules(node, context);
				break;
			default:
				break;
		}
		this.append_semantic_diagnostics(request);
	}
}
