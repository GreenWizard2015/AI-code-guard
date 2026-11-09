import type { ASTSourceRuleContract } from "src/ast_verifier_protocols";
import { RULE_IDS } from "src/linting/constants";
import { ObjectIntrinsicModel } from "src/linting/object_intrinsic_model";
import { StructuredValueRules } from "src/linting/structured_value_rules";
import { ExternalImportedTypes } from "src/linting/test-support/external_imported_types";
import { FakeObject } from "src/linting/test-support/fake_object";
import { TypeScriptStaticExpressionOperations } from "src/parser/typescript-aliases/type_script_static_expression_operations";
import { TypeScriptStaticExpressionValues } from "src/parser/typescript-aliases/type_script_static_expression_values";
import type { ObjectValueRulesContract } from "src/runtime_protocols";
import type { StaticExpressionValuesContract } from "src/shared_services_protocols";
import type { FakeObjectContract } from "src/shared_services_protocols";
import type { LintStageTimerContract } from "src/shared_services_protocols";
import type { RuleContextContract } from "src/types";
import type { CallableRuleAppender } from "src/types";
import type { TypeScriptNodeVerificationRequest } from "src/typescript_analysis_types";
import type { TypeScriptObjectAliasDeclarationIndexContract } from "src/typescript_runtime_protocols";
import ts from "typescript";

/** Responsibilities: _value node classification_, _value diagnostic reporting_. **/
export class TypeScriptValueNodeVerifier implements ASTSourceRuleContract {
	private readonly _structured_rules: StructuredValueRules;
	private readonly _object_rules: ObjectValueRulesContract;
	private readonly _fake_object: FakeObjectContract;
	private readonly _rule_ids: typeof RULE_IDS;

	/** Responsibilities: _intrinsic call diagnostics_. **/
	private append_intrinsic_calls(call: ts.CallExpression, context: RuleContextContract): void {
		const stage_timer = context.state().analysis.stage_timer;
		const string_call = stage_timer.measure(`rule.${this._rule_ids.typescript_object_prototype_string}`, () =>
			this._object_rules.object_string(call),
		);
		if (string_call) {
			context.for_node(call).append_rule(this._rule_ids.typescript_object_prototype_string);
			return;
		}
		const method_call = stage_timer.measure(`rule.${this._rule_ids.typescript_object_method_call}`, () =>
			this._object_rules.object_method(call),
		);
		if (method_call) {
			context.for_node(call).append_rule(this._rule_ids.typescript_object_method_call);
		}
	}

	/** Responsibilities: _fake object diagnostics_. **/
	private append_fake_object(node: ts.Node, context: RuleContextContract): void {
		if (!context.state().source.test_file) {
			context.state().analysis.stage_timer.measure(`rule.${this._rule_ids.typescript_fake_object}`, () => {
				if (this._fake_object.fake_object(node)) {
					context.for_node(node).append_rule(this._rule_ids.typescript_fake_object);
				}
			});
		}
	}

	/** Responsibilities: _value shape diagnostics_. **/
	private append_value_shapes(
		node: ts.Node,
		append_rule: CallableRuleAppender,
		stage_timer: LintStageTimerContract,
	): void {
		stage_timer.measure("rule.typescript-literal-object-access", () => {
			if (ts.isElementAccessExpression(node)) {
				const key = node.argumentExpression;
				if (key !== undefined && ts.isStringLiteralLike(key)) {
					append_rule(node, this._rule_ids.typescript_literal_object_access);
				}
			}
		});
		stage_timer.measure(`rule.${this._rule_ids.multiple_result_shapes}`, () => {
			if (this._structured_rules.structured_value(node)) {
				append_rule(node, this._rule_ids.multiple_result_shapes);
			}
		});
	}

	/** Responsibilities: _value verifier dependencies_. **/
	public constructor(declaration_index: TypeScriptObjectAliasDeclarationIndexContract) {
		this._rule_ids = RULE_IDS;
		const values: StaticExpressionValuesContract = new TypeScriptStaticExpressionValues(
			new TypeScriptStaticExpressionOperations(),
		);
		this._structured_rules = new StructuredValueRules(values);
		this._object_rules = new ObjectIntrinsicModel(values, declaration_index);
		this._fake_object = new FakeObject(new ExternalImportedTypes());
	}

	/** Responsibilities: _value verifier source activation_. **/
	public active_for(source_code: string): boolean {
		return source_code.length > 0;
	}

	/** Responsibilities: _value diagnostic selection_. **/
	public verify(request: TypeScriptNodeVerificationRequest): void {
		const { node, context } = request;
		const stage_timer = context.state().analysis.stage_timer;
		const append_rule: CallableRuleAppender = (candidate, rule_id): void => {
			context.for_node(candidate).append_rule(rule_id);
		};
		this.append_value_shapes(node, append_rule, context.state().analysis.stage_timer);
		if (ts.isCallExpression(node)) {
			const assign = stage_timer.measure(`rule.${this._rule_ids.typescript_object_assign}`, () =>
				this._object_rules.object_assign(node),
			);
			if (assign) {
				append_rule(node, this._rule_ids.typescript_object_assign);
			}
			this.append_intrinsic_calls(node, context);
		}
		this.append_fake_object(node, context);
	}
}
