import ts from "typescript";
import { JestTestRules } from "src/linting/orchestration/runtime/typescript-rule-groups/jest/jest_test_rules";
import { PrivateMemberAccess } from "src/linting/orchestration/runtime/typescript-rule-groups/private-member-access/private_member_access";
import { DictionaryReturns } from "src/linting/orchestration/runtime/typescript-rule-groups/object-literal-aliases/dictionary_returns";
import { PointlessAssignments } from "src/linting/orchestration/runtime/typescript-rule-groups/pointless_assignments";
import { PointlessExpression } from "src/linting/orchestration/runtime/typescript-rule-groups/pointless_expression";
import { RepeatedBranch } from "src/linting/orchestration/runtime/typescript-rule-groups/repeated_branch";
import { TypeOperations } from "src/linting/orchestration/runtime/typescript-rule-groups/type_operations";
import { TypeScriptAssignmentAnalysis } from "src/linting/orchestration/runtime/typescript-rule-groups/special-rules/type_script_assignment_analysis";
import { TypeScriptDeclarations } from "src/linting/orchestration/runtime/typescript-rule-groups/special-rules/type_script_declarations";
import { InlineTypes } from "src/linting/orchestration/runtime/typescript-rule-groups/inline_types";
import { TestPathSyntax } from "src/test_path_syntax";
import type { TypeScriptModuleResolverContract } from "src/module-resolution/protocols";
import type {
	JestTestRulesContract,
	LintStageTimerContract,
	PointlessAssignmentsContract,
	PrivateMemberAccessContract,
	TypeScriptAstTraversalContract,
	TypeScriptDictionaryReturnsContract,
	TypeScriptInlineRulesContract,
	TypeScriptRepeatedBranchContract,
	TypeScriptScriptDeclarationRulesContract,
	TypeScriptScriptRuleServicesContract,
	TypeScriptScriptRuleOptions,
	TypeScriptTypeOperationsContract,
	ViolationContract,
} from "src/protocols";

/** Responsibilities: _declaration rule application_, _Jest rule application_, _quality rule application_. **/
export class TypeScriptScriptRuleSet implements TypeScriptScriptRuleServicesContract {
	private readonly type_script_declarations: TypeScriptScriptDeclarationRulesContract;
	private readonly inline_types: TypeScriptInlineRulesContract;
	private readonly type_operations: TypeScriptTypeOperationsContract;
	private readonly dictionary_returns: TypeScriptDictionaryReturnsContract;
	private readonly jest_test_rules: JestTestRulesContract;
	private readonly pointless_assignments: PointlessAssignmentsContract;
	private readonly private_member_access: PrivateMemberAccessContract;
	private readonly repeated_branch: TypeScriptRepeatedBranchContract;
	private readonly test_path_syntax: TestPathSyntax;

	/** Responsibilities: _declaration and type rules_. **/
	private append_declaration_rules(options: TypeScriptScriptRuleOptions): void {
		const { violations, file, source_file, index, traversal, stage_timer } = options;
		stage_timer.measure("file-analysis.typescript.script-rule.declarations", () =>
			this.type_script_declarations.append_indexed_violations(
				violations,
				file,
				source_file,
				index.declaration_candidates,
			),
		);
		stage_timer.measure("file-analysis.typescript.script-rule.inline-types-and-operations", () =>
			this.append_type_rules(violations, file, source_file, traversal),
		);
		stage_timer.measure("file-analysis.typescript.script-rule.dictionary-returns", () =>
			this.dictionary_returns.dictionary_return_info(violations, file, source_file, index),
		);
	}

	/** Responsibilities: _Jest rule application_. **/
	private append_jest_rules(
		violations: ViolationContract[],
		file: string,
		source_file: ts.SourceFile,
		stage_timer: LintStageTimerContract,
		module_resolver: TypeScriptModuleResolverContract,
	): void {
		if (this.jest_test_rules.jest_file(file)) {
			stage_timer.measure("file-analysis.typescript.script-rule.jest", () =>
				this.jest_test_rules.append_violations(violations, file, source_file, module_resolver),
			);
		}
	}

	/** Responsibilities: _quality rule application_. **/
	private append_quality_rules(
		violations: ViolationContract[],
		file: string,
		source_file: ts.SourceFile,
		traversal: TypeScriptAstTraversalContract,
		stage_timer: LintStageTimerContract,
	): void {
		stage_timer.measure("file-analysis.typescript.script-rule.pointless-assignments", () =>
			this.pointless_assignments.append_assignment_violations(violations, file, source_file),
		);
		stage_timer.measure("file-analysis.typescript.script-rule.private-member-access", () =>
			this.private_member_access.append_private_access(violations, file, source_file, traversal),
		);
		stage_timer.measure("file-analysis.typescript.script-rule.repeated-branch", () =>
			this.repeated_branch.repeated_branch(violations, file, source_file),
		);
	}

	/** Responsibilities: _shared inline-type operation traversal_. **/
	private append_type_rules(
		violations: ViolationContract[],
		file: string,
		source_file: ts.SourceFile,
		traversal: TypeScriptAstTraversalContract,
	): void {
		if (this.test_path_syntax.test_ts(file)) {
			return;
		}
		traversal.visit((node) => {
			this.inline_types.append_node(violations, file, source_file, node);
			this.type_operations.append_node_operation(violations, file, source_file, node);
		});
	}

	/** Responsibilities: _rule service composition_. **/
	public constructor() {
		this.type_script_declarations = new TypeScriptDeclarations();
		this.inline_types = new InlineTypes();
		this.type_operations = new TypeOperations();
		this.dictionary_returns = new DictionaryReturns();
		this.jest_test_rules = new JestTestRules();
		this.private_member_access = new PrivateMemberAccess();
		this.repeated_branch = new RepeatedBranch();
		this.test_path_syntax = new TestPathSyntax();
		const pointless_expression = new PointlessExpression();
		const assignment_analysis = new TypeScriptAssignmentAnalysis(pointless_expression);
		this.pointless_assignments = new PointlessAssignments(assignment_analysis, pointless_expression);
	}

	/** Responsibilities: _script rule orchestration_. **/
	public append_rules(options: TypeScriptScriptRuleOptions): void {
		const { violations, file, source_file, traversal, stage_timer } = options;
		this.append_declaration_rules(options);
		this.append_jest_rules(violations, file, source_file, stage_timer, options.module_resolver);
		this.append_quality_rules(violations, file, source_file, traversal, stage_timer);
	}
}
