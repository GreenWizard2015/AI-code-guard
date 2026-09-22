import { DictionaryReturns } from 'src/bridge/ts/runner/orchestration/runtime/typescript-rule-groups/dictionary-returns';
import { InlineTypes } from 'src/bridge/ts/runner/orchestration/runtime/typescript-rule-groups/inline-types';
import { ObjectLiteralReturns } from 'src/bridge/ts/runner/orchestration/runtime/typescript-rule-groups/object-literal-returns';
import { PointlessAssignments } from 'src/bridge/ts/runner/orchestration/runtime/typescript-rule-groups/pointless-assignments';
import { PrivateMemberAccess } from 'src/bridge/ts/runner/orchestration/runtime/typescript-rule-groups/private-member-access';
import { RepeatedBranch } from 'src/bridge/ts/runner/orchestration/runtime/typescript-rule-groups/repeated-branch';
import { TypeOperations } from 'src/bridge/ts/runner/orchestration/runtime/typescript-rule-groups/type-operations';
import { JestTestRules } from 'src/bridge/ts/runner/orchestration/runtime/typescript-rule-groups/jest/jest-test-rules';
import { TypeScriptDeclarations } from 'src/bridge/ts/runner/orchestration/runtime/typescript-rule-groups/typescript-declarations';
import type { Violation } from 'src/protocols';
import type { TypeScriptScannerRuleContext } from 'src/bridge/ts/runner/orchestration/runtime/types';
import type { TypeScriptRuleGroupContract } from 'src/bridge/ts/runner/orchestration/runtime/typescript-rule-groups/types';

/** Responsibilities: _TypeScript declaration rules application_, _application expression Jest rules_. **/
export class TypeScriptScriptRuleGroup implements TypeScriptRuleGroupContract {
	private readonly context: TypeScriptScannerRuleContext;
	private readonly type_script_declarations = new TypeScriptDeclarations();
	private readonly inline_types = new InlineTypes();
	private readonly type_operations = new TypeOperations();
	private readonly dictionary_returns = new DictionaryReturns();
	private readonly object_literal_returns: ObjectLiteralReturns;
	private readonly jest_test_rules = new JestTestRules();
	private readonly pointless_assignments = new PointlessAssignments();
	private readonly private_member_access = new PrivateMemberAccess();
	private readonly repeated_branch = new RepeatedBranch();

	/** Responsibilities: _script rule context_, _object result analysis_. **/
	public constructor(context: TypeScriptScannerRuleContext) {
		this.context = context;
		this.object_literal_returns = new ObjectLiteralReturns(
			context.project_contract_names,
			new Set(context.ast.type_declarations.map(declaration => declaration.name)),
		);
	}

	/** Responsibilities: _script-level TypeScript violations addition_. **/
	public append(violations: Violation[]): void {
		const file = this.context.file_name.value;
		const source_file = this.context.ast_file.source_file;
		this.type_script_declarations.append_prefix_violations(violations, file, source_file);
		this.inline_types.append_inline_types(violations, file, source_file);
		this.type_operations.append_type_ops(violations, file, source_file);
		this.dictionary_returns.dictionary_return_info(violations, file, source_file);
		this.object_literal_returns.append_violations(violations, file, source_file);
		if (this.jest_test_rules.jest_file(file)) {
			this.jest_test_rules.append_violations(violations, file, source_file);
		}
		this.pointless_assignments.append_assignment_violations(violations, file, source_file);
		this.private_member_access.append_private_access(violations, file, source_file);
		this.repeated_branch.repeated_branch(violations, file, source_file);
	}
}
