import { TypeScriptAstErrorRules } from "src/linting/orchestration/runtime/typescript-rule-groups/special-rules/type_script_ast_error_rules";
import { TypeScriptAstStateRules } from "src/linting/orchestration/runtime/typescript-rule-groups/special-rules/type_script_ast_state_rules";
import { TypeScriptAstTypeRules } from "src/linting/orchestration/runtime/typescript-rule-groups/special-rules/type_script_ast_type_rules";
import { UnboundedRetryLoop } from "src/linting/orchestration/runtime/typescript-rule-groups/special-rules/unbounded_retry_loop";
import { InconsistentCacheKey } from "src/linting/orchestration/runtime/typescript-rule-groups/special-rules/inconsistent_cache_key";
import ts from "typescript";
import type { ViolationContract } from "src/reporting_protocols";
import type {
	TypeScriptAstErrorRulesContract,
	TypeScriptAstSpecialRulesContract,
	TypeScriptAstStateRulesContract,
	TypeScriptAstTypeRulesContract,
	TypeScriptCacheKeyRuleContract,
	TypeScriptRetryRuleContract,
} from "src/linting/orchestration/runtime/typescript-rule-groups/types";
import type { TypeScriptScannerRuleContextContract } from "src/model/types/types";

/** Responsibilities: _production rule coordination_, _auxiliary rule collection_. **/
export class TypeScriptAstSpecialRules implements TypeScriptAstSpecialRulesContract {
	private readonly context: TypeScriptScannerRuleContextContract;
	private readonly error_rules: TypeScriptAstErrorRulesContract;
	private readonly type_rules: TypeScriptAstTypeRulesContract;
	private readonly state_rules: TypeScriptAstStateRulesContract;
	private readonly retry_rules: TypeScriptRetryRuleContract;
	private readonly cache_rules: TypeScriptCacheKeyRuleContract;

	/** Responsibilities: _shared TypeScript auxiliary-rule traversal_. **/
	private append_production_rules(violations: ViolationContract[]): void {
		const source_file = this.context.ast_file.source_file_node();
		const type_violations: ViolationContract[] = [];
		const state_violations: ViolationContract[] = [];
		const visit = (node: ts.Node): void => {
			this.type_rules.append_node(type_violations, source_file, node);
			this.state_rules.append_node(state_violations, source_file, node);
			this.retry_rules.retry_detection(state_violations, this.context.file_name.value, source_file, node);
			this.cache_rules.append_node(state_violations, this.context.file_name.value, source_file, node);
			node.forEachChild(visit);
		};
		visit(source_file);
		violations.push(...type_violations, ...state_violations);
	}

	/** Responsibilities: _special rule coordination initialization_. **/
	public constructor(context: TypeScriptScannerRuleContextContract) {
		this.context = context;
		this.error_rules = new TypeScriptAstErrorRules(context);
		this.type_rules = new TypeScriptAstTypeRules(context);
		this.state_rules = new TypeScriptAstStateRules(context);
		this.retry_rules = new UnboundedRetryLoop();
		this.cache_rules = new InconsistentCacheKey();
	}

	/** Responsibilities: _error rule diagnostics_. **/
	public append_error_rules(violations: ViolationContract[]): void {
		this.error_rules.append_empty_catches(violations);
		this.error_rules.append_error_rules(violations);
	}

	/** Responsibilities: _auxiliary rule diagnostics_. **/
	public append_auxiliary_rules(violations: ViolationContract[]): void {
		if (this.context.file_name.test()) {
			this.type_rules.append_type_rules(violations);
			return;
		}
		this.append_production_rules(violations);
	}
}
