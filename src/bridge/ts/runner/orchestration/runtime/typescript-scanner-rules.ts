import type { Violation } from 'src/protocols';
import type { TypeScriptScannerRuleContext } from 'src/bridge/ts/runner/orchestration/runtime/types';
import { TypeScriptAstRuleGroup } from 'src/bridge/ts/runner/orchestration/runtime/typescript-rule-groups/typescript-ast-rule-group';
import { TypeScriptCallableRuleGroup } from 'src/bridge/ts/runner/orchestration/runtime/typescript-rule-groups/typescript-callable-rule-group';
import { TypeScriptClassRuleGroup } from 'src/bridge/ts/runner/orchestration/runtime/typescript-rule-groups/typescript-class-rule-group';
import { TypeScriptFileRuleGroup } from 'src/bridge/ts/runner/orchestration/runtime/typescript-rule-groups/typescript-file-rule-group';
import { TypeScriptScriptRuleGroup } from 'src/bridge/ts/runner/orchestration/runtime/typescript-rule-groups/typescript-script-rule-group';
import { TypeScriptSharedRuleGroup } from 'src/bridge/ts/runner/orchestration/runtime/typescript-rule-groups/typescript-shared-rule-group';
import type { TypeScriptRuleGroupContract } from 'src/bridge/ts/runner/orchestration/runtime/typescript-rule-groups/types';

/** Responsibilities: _TypeScript rule groups initialization_, _their violations addition_. **/
export class TypeScriptScannerRules implements TypeScriptRuleGroupContract {
	private readonly file_rules: TypeScriptFileRuleGroup;
	private readonly ast_rules: TypeScriptAstRuleGroup;
	private readonly script_rules: TypeScriptScriptRuleGroup;
	private readonly class_rules: TypeScriptClassRuleGroup;
	private readonly callable_rules: TypeScriptCallableRuleGroup;
	private readonly shared_rules: TypeScriptSharedRuleGroup;

	/** Responsibilities: _initialization TypeScript rule groups_. **/
	public constructor(context: TypeScriptScannerRuleContext) {
		this.file_rules = new TypeScriptFileRuleGroup(context);
		this.ast_rules = new TypeScriptAstRuleGroup(context);
		this.script_rules = new TypeScriptScriptRuleGroup(context);
		this.class_rules = new TypeScriptClassRuleGroup(context);
		this.callable_rules = new TypeScriptCallableRuleGroup(context);
		this.shared_rules = new TypeScriptSharedRuleGroup(context);
	}

	/** Responsibilities: _aggregation violations every TypeScript_. **/
	public append(violations: Violation[]): void {
		this.file_rules.append(violations);
		this.ast_rules.append(violations);
		this.script_rules.append(violations);
		this.class_rules.append(violations);
		this.callable_rules.append(violations);
		this.shared_rules.append(violations);
	}
}
