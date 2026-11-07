import type { ValueRulesContract } from "src/analysis_protocols";
import { ValueRules } from "src/linting/value_rules";
import { BROAD_CATCH, TYPEOF, TYPE_ASSERTION } from "src/parser/internals/constants";
import { TypeScriptCatchClause } from "src/rules/typescript/syntax-rules/expressions/catch/type_script_catch_clause";
import { TypeScriptJsonParseCatchBoundary } from "src/rules/typescript/syntax-rules/expressions/catch/type_script_json_parse_catch_boundary";
import { TypeScriptVmExecutionCatchBoundary } from "src/rules/typescript/syntax-rules/expressions/catch/type_script_vm_execution_catch_boundary";
import type { CallableRuleAppender } from "src/types";
import type { TypeScriptVariableDeclarationIndexContract } from "src/typescript_analysis_protocols";
import type { TypeScriptExpressionRuleContract } from "src/typescript_runtime_protocols";
import type { TypeScriptObjectAliasDeclarationIndexContract } from "src/typescript_runtime_protocols";
import ts from "typescript";

/** Responsibilities: _catch policy_, _value expression policies_. **/
export class TypeScriptExpressionTerminalRules implements TypeScriptExpressionRuleContract {
	private readonly _value_rules: ValueRulesContract;

	/** Responsibilities: _JSON failure boundary classification_. **/
	private is_json_boundary(json_clause: ts.CatchClause): boolean {
		const boundary = new TypeScriptJsonParseCatchBoundary(json_clause);
		if (!boundary.parse_operation()) {
			return false;
		}
		return boundary.failure_result();
	}

	/** Responsibilities: _VM failure boundary classification_. **/
	private is_vm_boundary(vm_clause: ts.CatchClause): boolean {
		const boundary = new TypeScriptVmExecutionCatchBoundary(vm_clause);
		if (!boundary.imports_vm_runtime() || !boundary.vm_call()) {
			return false;
		}
		if (boundary.stores_failure()) {
			return true;
		}
		return boundary.returns_failure();
	}

	/** Responsibilities: _broad catch diagnostics_. **/
	private append_catch_clause(catch_clause: ts.CatchClause, append_violation: CallableRuleAppender): void {
		if (this.is_json_boundary(catch_clause)) {
			return;
		}
		if (this.is_vm_boundary(catch_clause)) {
			return;
		}
		const catch_policy = new TypeScriptCatchClause(catch_clause);
		if (catch_policy.reports_broad_catch()) {
			append_violation(catch_clause, BROAD_CATCH);
		}
	}

	/** Responsibilities: _value expression diagnostics_. **/
	private append_value_rules(expression: ts.Node, append_rule: CallableRuleAppender): void {
		if (ts.isTypeOfExpression(expression)) {
			if (this._value_rules.repeated_typeof(expression)) {
				append_rule(expression, TYPEOF);
			}
		}
		if (ts.isTypeAssertionExpression(expression)) {
			append_rule(expression, TYPE_ASSERTION);
			return;
		}
		if (!ts.isAsExpression(expression)) {
			return;
		}
		if (expression.type.getText(expression.getSourceFile()) !== "const") {
			append_rule(expression, TYPE_ASSERTION);
		}
	}

	/** Responsibilities: _terminal expression dependency initialization_. **/
	public constructor(
		variable_declaration_index: TypeScriptVariableDeclarationIndexContract,
		declaration_index: TypeScriptObjectAliasDeclarationIndexContract,
	) {
		this._value_rules = new ValueRules(variable_declaration_index, declaration_index);
	}

	/** Responsibilities: _terminal expression rule collection_. **/
	public append(expression_node: ts.Node, append_rule: CallableRuleAppender): void {
		if (ts.isCatchClause(expression_node)) {
			this.append_catch_clause(expression_node, append_rule);
			return;
		}
		this.append_value_rules(expression_node, append_rule);
	}
}
