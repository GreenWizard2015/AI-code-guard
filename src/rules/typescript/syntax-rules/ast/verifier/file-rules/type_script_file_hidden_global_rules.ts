import type { ASTSourceRuleContract } from "src/ast_verifier_protocols";
import { RULE_IDS } from "src/linting/constants";
import { TypeScriptHiddenGlobalStateIndex } from "src/rules/typescript/syntax-rules/ast/verifier/file-rules/type_script_hidden_global_state_index";
import type { TypeScriptHiddenGlobalStateIndexContract } from "src/rules/typescript/syntax-rules/types";
import type {
	TypeScriptNodeVerificationRequest,
	TypeScriptSourceVerificationRequest,
} from "src/typescript_analysis_types";
import ts from "typescript";

/** Responsibilities: _hidden global rule_, _source lifecycle_. **/
export class TypeScriptFileHiddenGlobalRules implements ASTSourceRuleContract {
	private readonly _state_index: TypeScriptHiddenGlobalStateIndexContract;

	/** Responsibilities: _hidden global rule dependencies_. **/
	public constructor() {
		this._state_index = new TypeScriptHiddenGlobalStateIndex();
	}

	/** Responsibilities: _source eligibility_. **/
	public active_for(source_code: string): boolean {
		return source_code.length > 0;
	}

	/** Responsibilities: _hidden global state policy_. **/
	public verify(request: TypeScriptNodeVerificationRequest): void {
		const { context, node } = request;
		context.state().analysis.stage_timer.measure(`rule.${RULE_IDS.hidden_global_state}.typescript`, () => {
			if (ts.isSourceFile(node)) {
				this._state_index.reset_source();
				return;
			}
			if (ts.isVariableStatement(node)) {
				this._state_index.append_collection_declarations(node, context.state().source.source_file);
				return;
			}
			if (ts.isBinaryExpression(node) || ts.isCallExpression(node)) {
				this._state_index.append_mutation(context, node);
			}
		});
	}

	/** Responsibilities: _shared state source reporting_. **/
	public finish_source(request: TypeScriptSourceVerificationRequest): void {
		const { context } = request;
		context.state().analysis.stage_timer.measure(`rule.${RULE_IDS.hidden_global_state}.typescript`, () => {
			const mutations = this._state_index.take_mutations(context);
			if (mutations.length === 0) {
				this._state_index.reset_source();
				return;
			}
			if (context.state().source.test_file) {
				this._state_index.reset_source();
				return;
			}
			this._state_index.report_shared_state(context, mutations);
			this._state_index.reset_source();
		});
	}
}
