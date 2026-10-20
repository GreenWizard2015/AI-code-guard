import ts from "typescript";
import { AnyTypes } from "src/rules/typescript/syntax-rules/types/any_types";
import { DiagnosticRule } from "src/model/diagnostic_rule";
import { TypeScriptTypeAliases } from "src/typescript-aliases/type_script_type_aliases";
import { MetricViolations } from "src/metrics/metric_violations";
import { CallableMetrics } from "src/metrics/callable_metrics";
import { MethodContractRules } from "src/metrics/method_contract_rules";
import { TypeScriptCallableBoundary } from "src/linting/orchestration/runtime/typescript-rule-groups/type_script_callable_boundary";
import { TypeScriptBoundaryAliases } from "src/linting/orchestration/runtime/typescript-rule-groups/type_script_boundary_aliases/type_script_boundary_aliases";
import { TypeScriptClassMembers } from "src/parser/analysis/type_script_class_members";
import { MAX_CALLABLE_BRANCHES } from "src/constants";
import { TypeScriptHiddenGlobalState } from "src/linting/orchestration/runtime/typescript-rule-groups/type_script_hidden_global_state";
import { TypeScriptTemporalCoupling } from "src/linting/orchestration/runtime/typescript-rule-groups/temporal/type_script_temporal_coupling";

import type { AnyTypesContract, MethodContractRulesContract } from "src/shared_services_protocols";
import type { MetricViolationsContract } from "src/reporting_protocols";
import type { TypeScriptClassMembersContract } from "src/typescript_analysis_protocols";
import type { ViolationContract } from "src/reporting_protocols";
import type { AstCallableNodeContract } from "src/types";
import type { TypeScriptScannerRuleContextContract } from "src/model/types/types";
import type {
	TypeScriptCallableMetricsInput,
	TypeScriptRuleGroupContract,
} from "src/linting/orchestration/runtime/typescript-rule-groups/types";

/** Responsibilities: _callable metrics application_, _application callable naming type_. **/
export class TypeScriptCallableRuleGroup implements TypeScriptRuleGroupContract {
	private readonly context: TypeScriptScannerRuleContextContract;
	private readonly any_types: AnyTypesContract;
	private readonly metric_violations: MetricViolationsContract;
	private readonly method_contract_rules: MethodContractRulesContract;
	private readonly class_members: TypeScriptClassMembersContract;
	private readonly hidden_global_state: TypeScriptHiddenGlobalState;
	private readonly temporal_coupling: TypeScriptTemporalCoupling;
	private readonly boundary: TypeScriptCallableBoundary;
	private readonly branch_kinds: ReadonlySet<ts.SyntaxKind>;

	/** Responsibilities: _callable branch selection_. **/
	private named_callable(node: ts.Node): boolean {
		if (ts.isFunctionDeclaration(node)) {
			return true;
		}
		if (ts.isMethodDeclaration(node)) {
			return true;
		}
		if (ts.isConstructorDeclaration(node)) {
			return true;
		}
		return ts.isGetAccessorDeclaration(node) || ts.isSetAccessorDeclaration(node);
	}

	/** Responsibilities: _branch count collection_. **/
	private branch_counts(): Map<ts.Node, number> {
		const branch_counts = new Map<ts.Node, number>();
		const source_file = this.context.ast_file.source_file_node();
		this.context.traversal.visit_function_owners((node, owner) => {
			if (owner === source_file) {
				return;
			}
			if (!this.named_callable(owner)) {
				return;
			}
			if (!this.branch_kinds.has(node.kind)) {
				return;
			}
			let previous_count = branch_counts.get(owner);
			if (previous_count === undefined) {
				previous_count = 0;
			}
			branch_counts.set(owner, previous_count + 1);
		});
		return branch_counts;
	}

	/** Responsibilities: _callable branch-count diagnostics_. **/
	private append_branch_counts(violations: ViolationContract[]): void {
		if (this.context.file_name.test()) {
			return;
		}
		const source_file = this.context.ast_file.source_file_node();
		const branch_counts = this.branch_counts();
		const rule = new DiagnosticRule("callable-branch-count");
		for (const [node, count] of branch_counts) {
			if (count > MAX_CALLABLE_BRANCHES) {
				violations.push(
					rule.violation(
						this.context.file_name.value,
						source_file.getLineAndCharacterOfPosition(node.getStart(source_file)).line + 1,
						{},
					),
				);
			}
		}
	}

	/** Responsibilities: _function metric violations addition_. **/
	private append_function_metrics(
		violations: ViolationContract[],
		file: string,
		functions: readonly AstCallableNodeContract[],
	): void {
		if (this.context.file_name.test()) {
			return;
		}
		for (const node of functions) {
			const metrics = new CallableMetrics(violations, file, node, false);
			metrics.append_callable_metrics();
		}
	}

	/** Responsibilities: _metrics and boundary rules_. **/
	private append_callable_metrics(input: TypeScriptCallableMetricsInput): void {
		const { violations, file, functions, methods, classes, fields } = input;
		const type_alias_fields = this.context.ast_file
			.source_file_node()
			.statements.filter(ts.isTypeAliasDeclaration)
			.flatMap((node) => this.class_members.type_alias_fields(node));
		this.append_function_metrics(violations, file, functions);
		this.any_types.append_any_info(violations, file, functions, methods, classes);
		this.boundary.append_callables(violations, [...functions, ...methods]);
		this.boundary.append_fields(violations, [...fields, ...type_alias_fields]);
		this.method_contract_rules.append(violations, file, methods);
		this.method_contract_rules.append_flag_parameters(violations, file, [...functions, ...methods]);
		this.metric_violations.append_depth_violations(violations, file, this.context.ast.attribute_accesses);
	}

	/** Responsibilities: _callable rule context initialization_. **/
	public constructor(context: TypeScriptScannerRuleContextContract) {
		this.metric_violations = new MetricViolations();
		this.method_contract_rules = new MethodContractRules();
		this.context = context;
		this.class_members = new TypeScriptClassMembers(context.ast_file.source_file_node());
		this.hidden_global_state = new TypeScriptHiddenGlobalState(context.ast_file.source_file_node());
		this.temporal_coupling = new TypeScriptTemporalCoupling(context.ast_file.source_file_node());
		this.boundary = new TypeScriptCallableBoundary(context, new TypeScriptBoundaryAliases(context.module_resolver));
		this.branch_kinds = new Set([
			ts.SyntaxKind.IfStatement,
			ts.SyntaxKind.ForStatement,
			ts.SyntaxKind.ForInStatement,
			ts.SyntaxKind.ForOfStatement,
			ts.SyntaxKind.WhileStatement,
			ts.SyntaxKind.DoStatement,
			ts.SyntaxKind.CaseClause,
			ts.SyntaxKind.DefaultClause,
			ts.SyntaxKind.ConditionalExpression,
			ts.SyntaxKind.CatchClause,
		]);
		const type_aliases = new TypeScriptTypeAliases();
		type_aliases.collect(context.ast_file.source_file_node());
		this.any_types = new AnyTypes(type_aliases);
	}

	/** Responsibilities: _aggregation callable rule violations_. **/
	public append(violations: ViolationContract[]): void {
		const file = this.context.file_name.value;
		const functions = this.context.ast.functions;
		const classes = this.context.ast.classes;
		const methods = classes.flatMap((node) => node.methods);
		const fields = classes.flatMap((node) => node.fields);
		this.append_branch_counts(violations);
		if (!this.context.file_name.test()) {
			if (this.hidden_global_state.collections_present()) {
				this.hidden_global_state.append(violations, file);
			}
		}
		if (!this.context.file_name.test()) {
			this.temporal_coupling.append(violations, file);
		}
		this.append_callable_metrics({ violations, file, functions, methods, classes, fields });
	}
}
