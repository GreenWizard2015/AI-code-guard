import { FakeObject } from "src/fake-object";
import { ObjectValueRules } from "src/bridge/ts/runner/object-value-rules";
import ts from "typescript";
import { TypeScriptTypeNode } from "src/model/typescript-type-node";
import { TypeScriptVariableBinding } from "src/bridge/ts/runner/typescript-variable-binding";
import { TypeScriptExpressionAliases } from "src/typescript-aliases/typescript-expression-aliases";
import { TypeScriptStaticExpressionValues } from "src/typescript-callable-aliases/typescript-static-expression-values";
import { TypeScriptCallableBody } from "src/typescript-callable-aliases/typescript-callable-body";

import type { RuleAppender } from "src/bridge/ts/runner/types";

/** Responsibilities: _classification primitive values typeof_. **/
export class ValueRules {
	private readonly rule_ids = {
		structured: "multiple-result-shapes",
		object_to_string: "typescript-object-prototype-string",
		object_assign: "typescript-object-assign",
		object_method_call: "typescript-object-method-call",
		fake_object: "typescript-fake-object",
	};
	private readonly type_aliases = new TypeScriptExpressionAliases("type");
	private readonly variable_bindings = new Map<ts.SourceFile, TypeScriptVariableBinding>();
	private readonly static_expression_values = new TypeScriptStaticExpressionValues();
	private readonly structured_names = new Set(["structuredContent", "unwrap_tool_result"]);
	private readonly object_value_rules = new ObjectValueRules();
	private readonly fake_object = new FakeObject();
	private readonly callable_body = new TypeScriptCallableBody();

	/** Responsibilities: _classification static key wrapper_. **/
	private key_wrapper(expression: ts.Expression): boolean {
		if (ts.isParenthesizedExpression(expression) || ts.isNonNullExpression(expression)) {
			return true;
		}
		if (ts.isAsExpression(expression) || ts.isTypeAssertionExpression(expression)) {
			return true;
		}
		return ts.isSatisfiesExpression(expression);
	}

	/** Responsibilities: _unwrapping static key_. **/
	private unwrapped_key(expression: ts.Expression): ts.Expression {
		while (this.key_wrapper(expression)) {
			if (ts.isParenthesizedExpression(expression) || ts.isNonNullExpression(expression)) {
				expression = expression.expression;
				continue;
			}
			if (ts.isAsExpression(expression) || ts.isTypeAssertionExpression(expression)) {
				expression = expression.expression;
				continue;
			}
			if (ts.isSatisfiesExpression(expression)) {
				expression = expression.expression;
			}
		}
		return expression;
	}

	/** Responsibilities: _static result key resolution_. **/
	private structured_key(node: ts.ElementAccessExpression): string {
		const argument = node.argumentExpression;
		if (argument === undefined) {
			return "";
		}
		const key = this.unwrapped_key(argument);
		if (ts.isStringLiteral(key) || ts.isNoSubstitutionTemplateLiteral(key)) {
			return key.text;
		}
		return this.static_expression_values.value(argument, node);
	}

	/** Responsibilities: _result shape access classification_. **/
	private structured_value(node: ts.Node): boolean {
		if (ts.isIdentifier(node)) {
			return this.structured_names.has(node.text);
		}
		if (!ts.isElementAccessExpression(node)) {
			return false;
		}
		const key = this.structured_key(node);
		if (key === "") {
			return false;
		}
		return this.structured_names.has(key);
	}

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
	private property_type(source_file: ts.SourceFile, name: string): boolean {
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
	private bindings_for(source_file: ts.SourceFile): TypeScriptVariableBinding {
		const existing = this.variable_bindings.get(source_file);
		if (existing !== undefined) {
			return existing;
		}
		const bindings = new TypeScriptVariableBinding(source_file);
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
		if (this.structured_value(node)) {
			append_rule(node, this.rule_ids.structured);
		}
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
