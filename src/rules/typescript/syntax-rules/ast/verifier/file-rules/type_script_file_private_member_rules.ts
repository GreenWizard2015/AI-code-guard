import type { ASTSourceRuleContract } from "src/ast_verifier_protocols";
import type { PrivateAccessAnalysisContract } from "src/contracts/types/type_script_rule_group_types";
import { RULE_IDS } from "src/linting/constants";
import { TypeScriptStaticExpressionOperations } from "src/parser/typescript-aliases/type_script_static_expression_operations";
import type { ViolationContract } from "src/reporting_protocols";
import { PrivateAccessAnalysis } from "src/rules/typescript/syntax-rules/ast/verifier/inherited-state/private_access_analysis";
import type { RuleContextContract } from "src/types";
import type {
	TypeScriptNodeVerificationRequest,
	TypeScriptSourceVerificationRequest,
} from "src/typescript_analysis_types";
import ts from "typescript";

/** Responsibilities: _private member ownership_, _cross-owner access boundaries_. **/
export class TypeScriptFilePrivateMemberRules implements ASTSourceRuleContract {
	private readonly _analysis_by_context: WeakMap<RuleContextContract, PrivateAccessAnalysisContract>;

	/** Responsibilities: _private access source analysis_. **/
	private analysis(context: RuleContextContract): PrivateAccessAnalysisContract {
		const cached = this._analysis_by_context.get(context);
		if (cached !== undefined) {
			return cached;
		}
		const analysis = new PrivateAccessAnalysis({
			source_file: context.state().source.source_file,
			static_expression_operations: new TypeScriptStaticExpressionOperations(),
			traversal: context.state().analysis.traversal,
		});
		this._analysis_by_context.set(context, analysis);
		return analysis;
	}

	/** Responsibilities: _private access verifier initialization_. **/
	public constructor() {
		this._analysis_by_context = new WeakMap();
	}

	/** Responsibilities: _private member eligibility_. **/
	public active_for(source_code: string): boolean {
		return source_code.length > 0;
	}

	/** Responsibilities: _private member access policy_. **/
	public verify(request: TypeScriptNodeVerificationRequest): void {
		const { node, context } = request;
		const eligible_node =
			ts.isClassLike(node) || ts.isPropertyAccessExpression(node) || ts.isElementAccessExpression(node);
		if (!eligible_node) {
			return;
		}
		this.analysis(context).append_node(node);
	}

	/** Responsibilities: _private member access reporting_. **/
	public finish_source(request: TypeScriptSourceVerificationRequest): void {
		const { context } = request;
		const analysis = this._analysis_by_context.get(context);
		this._analysis_by_context.delete(context);
		if (analysis === undefined) {
			return;
		}
		context.state().analysis.stage_timer.measure(`rule.${RULE_IDS.private_member}`, () => {
			context.state().analysis.stage_timer.measure("file-analysis.typescript.script-rule.private-member-access", () => {
				const { file } = context.state().source;
				const violations: ViolationContract[] = [];
				analysis.append_private_access(violations, file);
				for (const violation of violations) {
					context.append_violation(violation);
				}
			});
		});
	}
}
