import { FakeObject } from "src/linting/test-support/fake_object";
import { ObjectValueRules } from "src/linting/object_value_rules";
import ts from "typescript";
import { TypeScriptTypeNode } from "src/model/type_script_type_node";
import { TypeScriptVariableBinding } from "src/linting/type_script_variable_binding";
import type {
	SourceFileBooleanMapCache,
	TypeScriptVariableBindingContract,
	TypeScriptVariableDeclarationIndexContract,
} from "src/protocols";
import { TypeScriptExpressionAliases } from "src/typescript-aliases/type_script_expression_aliases";
import { TypeScriptCallableBody } from "src/typescript-aliases/callables/type_script_callable_body";
import { TypeScriptStaticExpressionOperations } from "src/typescript-aliases/callables/type_script_static_expression_operations";
import { TypeScriptStaticExpressionValues } from "src/typescript-aliases/callables/type_script_static_expression_values";
import { StructuredValueRules } from "src/linting/structured_value_rules";

import type { RuleAppender } from "src/types";
import type { FakeObjectContract, ObjectValueRulesContract } from "src/protocols";
import type { ValueRulesContract } from "src/protocols";
import { RULE_IDS } from "src/constants";

/** Responsibilities: _object value checks_, _primitive property analysis_. **/
export class ValueRules implements ValueRulesContract {
	private readonly rule_ids = {
		structured: RULE_IDS.multiple_result_shapes,
		object_to_string: RULE_IDS.typescript_object_prototype_string,
		object_assign: RULE_IDS.typescript_object_assign,
		object_method_call: RULE_IDS.typescript_object_method_call,
		fake_object: RULE_IDS.typescript_fake_object,
	};
	private readonly type_aliases: TypeScriptExpressionAliases;
	private readonly variable_bindings: Map<ts.SourceFile, TypeScriptVariableBinding>;
	private readonly variable_declaration_index: TypeScriptVariableDeclarationIndexContract;
	private readonly primitive_properties: SourceFileBooleanMapCache;
	private readonly static_expression_values: TypeScriptStaticExpressionValues;
	private readonly structured_value_rules: StructuredValueRules;
	private readonly object_value_rules: ObjectValueRulesContract;
	private readonly fake_object: FakeObjectContract;
	private readonly callable_body: TypeScriptCallableBody;

	/** Responsibilities: _selection value rules applicable_. **/
	/** Responsibilities: _typeof expression count_. **/
	private count_typeof_expressions(root: ts.Node): number {
		let count = 0;
		const visit = (child: ts.Node): void => {
			if (ts.isTypeOfExpression(child)) {
				count += 1;
			}
			ts.forEachChild(child, visit);
		};
		visit(root);
		return count;
	}

	/** Responsibilities: _primitive variable classification_. **/
	/** Responsibilities: _primitive property classification_. **/
	private primitive_property_cache(source_file: ts.SourceFile): Map<string, boolean> {
		const cached = this.primitive_properties.get(source_file);
		if (cached !== undefined) {
			return cached;
		}
		const created = new Map<string, boolean>();
		this.primitive_properties.set(source_file, created);
		return created;
	}

	/** Responsibilities: _primitive property classification_. **/
	private property_type(source_file: ts.SourceFile, name: string): boolean {
		const cached = this.primitive_property_cache(source_file);
		const cached_result = cached.get(name);
		if (cached_result !== undefined) {
			return cached_result;
		}
		let found = false;
		const visit = (node: ts.Node): void => {
			if (found) {
				return;
			}
			if (this.is_primitive_property(node, name)) {
				found = true;
				return;
			}
			ts.forEachChild(node, visit);
		};
		visit(source_file);
		cached.set(name, found);
		return found;
	}

	/** Responsibilities: _classification property access resolution_. **/
	private is_primitive_property(node: ts.Node, name: string): boolean {
		if (!ts.isPropertySignature(node) && !ts.isPropertyDeclaration(node)) {
			return false;
		}
		if (!ts.isIdentifier(node.name)) {
			return false;
		}
		if (node.name.text !== name) {
			return false;
		}
		if (node.type === undefined) {
			return false;
		}
		const type_node = new TypeScriptTypeNode(node.type);
		return type_node.primitive();
	}

	/** Responsibilities: _resolution source variable bindings_. **/
	private bindings_for(source_file: ts.SourceFile): TypeScriptVariableBindingContract {
		const existing = this.variable_bindings.get(source_file);
		if (existing !== undefined) {
			return existing;
		}
		const bindings = new TypeScriptVariableBinding(source_file, this.variable_declaration_index);
		this.variable_bindings.set(source_file, bindings);
		return bindings;
	}

	/** Responsibilities: _aggregation value diagnostics selection_. **/
	private append_object_rules(node: ts.Node, append_rule: RuleAppender): void {
		const object_string = this.object_value_rules.object_string(node);
		if (object_string) {
			append_rule(node, this.rule_ids.object_to_string);
		}
		if (this.object_value_rules.object_assign(node)) {
			append_rule(node, this.rule_ids.object_assign);
		}
		if (this.object_value_rules.object_method(node)) {
			if (!object_string) {
				append_rule(node, this.rule_ids.object_method_call);
			}
		}
	}

	/** Responsibilities: _aggregation fake object diagnostic_. **/
	private fake_object_rule(node: ts.Node, test_file: boolean, append_rule: RuleAppender): void {
		if (test_file) {
			return;
		}
		if (this.fake_object.fake_object(node)) {
			append_rule(node, this.rule_ids.fake_object);
		}
	}

	/** Responsibilities: _aggregation structured value diagnostic_. **/
	private append_structured_rule(node: ts.Node, append_rule: RuleAppender): void {
		if (this.structured_value_rules.structured_value(node)) {
			append_rule(node, this.rule_ids.structured);
		}
	}

	/** Responsibilities: _value rule dependency initialization_. **/
	public constructor(variable_declaration_index: TypeScriptVariableDeclarationIndexContract) {
		this.type_aliases = new TypeScriptExpressionAliases("type");
		this.variable_bindings = new Map<ts.SourceFile, TypeScriptVariableBinding>();
		this.variable_declaration_index = variable_declaration_index;
		this.primitive_properties = new WeakMap<ts.SourceFile, Map<string, boolean>>();
		this.static_expression_values = new TypeScriptStaticExpressionValues(new TypeScriptStaticExpressionOperations());
		this.structured_value_rules = new StructuredValueRules(this.static_expression_values);
		this.callable_body = new TypeScriptCallableBody();
		this.object_value_rules = new ObjectValueRules();
		this.fake_object = new FakeObject();
	}

	/** Responsibilities: _aggregation value diagnostics selection_. **/
	public append_value_rules(node: ts.Node, test_file: boolean, append_rule: RuleAppender): void {
		this.append_structured_rule(node, append_rule);
		this.append_object_rules(node, append_rule);
		this.fake_object_rule(node, test_file, append_rule);
	}

	/** Responsibilities: _reporting repeated typeof checks_. **/
	public repeated_typeof(node: ts.TypeOfExpression): boolean {
		let owner: ts.Node | undefined = node.parent;
		while (owner !== undefined) {
			if (ts.isFunctionLike(owner)) {
				break;
			}
			owner = owner.parent;
		}
		if (owner === undefined) {
			return false;
		}
		return this.callable_body.resolve(owner, false, () => this.count_typeof_expressions(owner) > 1);
	}

	/** Responsibilities: _reporting primitive type operations_. **/
	public typed_primitive(expression: ts.Expression, source_file: ts.SourceFile): boolean {
		if (ts.isParenthesizedExpression(expression)) {
			return this.typed_primitive(expression.expression, source_file);
		}
		if (ts.isIdentifier(expression)) {
			return this.bindings_for(source_file).primitive(expression.text, expression);
		}
		if (ts.isPropertyAccessExpression(expression)) {
			return this.property_type(source_file, expression.name.text);
		}
		return false;
	}

	/** Responsibilities: _reporting dynamic class checks_. **/
	public dynamic_class(node: ts.Node): boolean {
		if (!ts.isCallExpression(node)) {
			return false;
		}
		if (!ts.isIdentifier(node.expression)) {
			return false;
		}
		return this.type_aliases.receiver(node.expression, node);
	}
}
