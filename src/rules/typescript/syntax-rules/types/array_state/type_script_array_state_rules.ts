import type { ASTSourceRuleContract } from "src/ast_verifier_protocols";
import { SINGLE_ARRAY_STATE } from "src/parser/internals/constants";
import { TypeScriptBindingAliases } from "src/parser/typescript-aliases/type_script_binding_aliases";
import { TypeScriptExpressionNames } from "src/parser/typescript-aliases/type_script_expression_names";
import { TypeScriptCallAliases } from "src/rules/typescript/syntax-rules/callables/type_script_call_aliases";
import type { TypeScriptNumericExpressionEvaluatorContract } from "src/rules/typescript/syntax-rules/types";
import { TypeScriptArrayCallableDeclarations } from "src/rules/typescript/syntax-rules/types/array_state/type_script_array_callable_declarations";
import { TypeScriptArrayStateInspector } from "src/rules/typescript/syntax-rules/types/array_state/type_script_array_state_inspector";
import { TypeScriptNumericExpressionEvaluator } from "src/rules/typescript/syntax-rules/types/array_state/type_script_numeric_expression_evaluator";
import { TypeScriptZeroIndexGuard } from "src/rules/typescript/syntax-rules/types/array_state/type_script_zero_index_guard";
import type { RuleContextContract } from "src/types";
import type { TypeScriptNodeVerificationRequest } from "src/typescript_analysis_types";
import ts from "typescript";

/** Responsibilities: _zero-index state diagnostics_, _guard-aware array access classification_. **/
export class TypeScriptArrayStateRules implements ASTSourceRuleContract {
	private readonly _array_rule_id: string;
	private readonly _callable_declarations: TypeScriptArrayCallableDeclarations;
	private readonly _inspector: TypeScriptArrayStateInspector;
	private readonly _numeric_evaluator: TypeScriptNumericExpressionEvaluatorContract;
	private readonly _zero_index_guard: TypeScriptZeroIndexGuard;

	/** Responsibilities: _zero-index guard classification_. **/
	private zero_index_guarded(guard_candidate: ts.Node): boolean {
		if (!ts.isIfStatement(guard_candidate)) {
			return false;
		}
		const name = this._zero_index_guard.guarded_name(guard_candidate.expression);
		if (name.length === 0) {
			return false;
		}
		return this._zero_index_guard.zero_assignment_precedes(guard_candidate, name);
	}

	/** Responsibilities: _array state composition_. **/
	public constructor() {
		this._array_rule_id = SINGLE_ARRAY_STATE;
		this._numeric_evaluator = new TypeScriptNumericExpressionEvaluator();
		this._zero_index_guard = new TypeScriptZeroIndexGuard(this._numeric_evaluator);
		const expression_names = new TypeScriptExpressionNames();
		const binding_aliases = new TypeScriptBindingAliases(expression_names);
		const call_aliases = new TypeScriptCallAliases(expression_names, binding_aliases);
		this._callable_declarations = new TypeScriptArrayCallableDeclarations(expression_names);
		this._inspector = new TypeScriptArrayStateInspector(expression_names, call_aliases, this._callable_declarations);
	}

	/** Responsibilities: _array access detection_. **/
	public array_access(access_candidate: ts.Node, source_file: ts.SourceFile): boolean {
		if (ts.isElementAccessExpression(access_candidate)) {
			return this._inspector.single_item_expression(access_candidate.expression, source_file);
		}
		if (ts.isVariableDeclaration(access_candidate) && ts.isArrayBindingPattern(access_candidate.name)) {
			return this._inspector.single_item_binding(access_candidate.name, source_file);
		}
		if (ts.isCallExpression(access_candidate)) {
			return this._inspector.single_item_method(access_candidate, source_file);
		}
		return false;
	}

	/** Responsibilities: _aggregation single-item array-state diagnostics_. **/
	public append(rule_candidate: ts.Node, rule_context: RuleContextContract): void {
		if (this.array_access(rule_candidate, rule_context.state().source.source_file)) {
			rule_context.for_node(rule_candidate).append_rule(this._array_rule_id);
			return;
		}
		if (this.zero_index_guarded(rule_candidate)) {
			rule_context.for_node(rule_candidate).append_rule(this._array_rule_id);
		}
	}

	/** Responsibilities: _array verifier source activation_. **/
	public active_for(source_code: string): boolean {
		return source_code.length > 0;
	}

	/** Responsibilities: _array verifier dispatch_. **/
	public verify(request: TypeScriptNodeVerificationRequest): void {
		this.append(request.node, request.context);
	}
}
