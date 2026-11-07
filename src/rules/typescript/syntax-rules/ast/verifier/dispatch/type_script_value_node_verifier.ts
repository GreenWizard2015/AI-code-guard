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

	/** Responsibilities: _object call diagnostics_. **/
	private object_call_ids(call: ts.CallExpression): string[] {
		const rule_ids: string[] = [];
		if (this._object_rules.object_assign(call)) {
			rule_ids.push(this._rule_ids.typescript_object_assign);
		}
		if (this._object_rules.object_string(call)) {
			rule_ids.push(this._rule_ids.typescript_object_prototype_string);
		} else if (this._object_rules.object_method(call)) {
			rule_ids.push(this._rule_ids.typescript_object_method_call);
		}
		return rule_ids;
	}

	/** Responsibilities: _value shape diagnostics_. **/
	private append_value_shapes(node: ts.Node, append_rule: CallableRuleAppender): void {
		if (ts.isElementAccessExpression(node)) {
			const key = node.argumentExpression;
			if (key !== undefined && ts.isStringLiteralLike(key)) {
				append_rule(node, this._rule_ids.typescript_literal_object_access);
			}
		}
		if (this._structured_rules.structured_value(node)) {
			append_rule(node, this._rule_ids.multiple_result_shapes);
		}
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
		const append_rule: CallableRuleAppender = (candidate, rule_id): void => {
			context.for_node(candidate).append_rule(rule_id);
		};
		this.append_value_shapes(node, append_rule);
		if (ts.isCallExpression(node)) {
			for (const rule_id of this.object_call_ids(node)) {
				append_rule(node, rule_id);
			}
		}
		if (!context.state().source.test_file) {
			if (this._fake_object.fake_object(node)) {
				append_rule(node, this._rule_ids.typescript_fake_object);
			}
		}
	}
}
