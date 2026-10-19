import type { ViolationContract } from "src/protocols";
import type { TypeScriptScannerRuleContextContract } from "src/model/types/types";
import { TypeScriptAstRuleGroup } from "src/linting/orchestration/runtime/typescript-rule-groups/type_script_ast_rule_group";
import { TypeScriptCallableRuleGroup } from "src/linting/orchestration/runtime/typescript-rule-groups/type_script_callable_rule_group";
import { TypeScriptClassRuleGroup } from "src/linting/orchestration/runtime/typescript-rule-groups/type_script_class_rule_group";
import { TypeScriptFileRuleGroup } from "src/linting/orchestration/runtime/typescript-rule-groups/type_script_file_rule_group";
import { TypeScriptScriptRuleGroup } from "src/linting/orchestration/runtime/typescript-rule-groups/type_script_script_rule_group";
import { TypeScriptSharedRuleGroup } from "src/linting/orchestration/runtime/typescript-rule-groups/type_script_shared_rule_group";
import type { TypeScriptRuleGroupContract } from "src/linting/orchestration/runtime/typescript-rule-groups/types";
import { CALLABLE_RULE_GROUP_NAME } from "src/linting/orchestration/runtime/constants";

/** Responsibilities: _TypeScript rule groups initialization_, _their violations addition_. **/
export class TypeScriptScannerRules implements TypeScriptRuleGroupContract {
	private readonly context: TypeScriptScannerRuleContextContract;
	private readonly file_rules: TypeScriptRuleGroupContract;
	private readonly ast_rules: TypeScriptRuleGroupContract;
	private readonly script_rules: TypeScriptRuleGroupContract;
	private readonly class_rules: TypeScriptRuleGroupContract;
	private readonly callable_rules: TypeScriptRuleGroupContract;
	private readonly shared_rules: TypeScriptRuleGroupContract;

	/** Responsibilities: _initialization TypeScript rule groups_. **/
	public constructor(context: TypeScriptScannerRuleContextContract) {
		this.context = context;
		this.file_rules = new TypeScriptFileRuleGroup(context);
		this.ast_rules = new TypeScriptAstRuleGroup(context);
		this.script_rules = new TypeScriptScriptRuleGroup(context);
		this.class_rules = new TypeScriptClassRuleGroup(context);
		this.callable_rules = new TypeScriptCallableRuleGroup(context);
		this.shared_rules = new TypeScriptSharedRuleGroup(context);
	}

	/** Responsibilities: _aggregation violations every TypeScript_. **/
	public append(violations: ViolationContract[]): void {
		for (const [name, group] of [
			["file", this.file_rules],
			["ast", this.ast_rules],
			["script", this.script_rules],
			["class", this.class_rules],
			[CALLABLE_RULE_GROUP_NAME, this.callable_rules],
			["shared", this.shared_rules],
		] as const) {
			this.context.stage_timer.measure(`file-analysis.typescript.rule-groups.${name}`, () => group.append(violations));
		}
	}
}
