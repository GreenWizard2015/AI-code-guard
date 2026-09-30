import ts from 'typescript';
import { TypeScriptExpressionAliases } from 'src/typescript-aliases/typescript-expression-aliases';
import { TypeScriptMemberAliases } from 'src/typescript-aliases/typescript-member-aliases';
import { TypeScriptStaticExpressionValues } from 'src/typescript-callable-aliases/typescript-static-expression-values';
import { ObjectValueRules } from 'src/bridge/ts/runner/object-value-rules';
import { DynamicObjectMemberAliases } from 'src/bridge/ts/dynamic-object-member-aliases';
import { DynamicRuntimeMemberExpressions } from 'src/bridge/ts/parser-internals/dynamic-runtime/dynamic-runtime-member-expressions';

/** Responsibilities: _dynamic runtime member collection_. **/
export class DynamicRuntimeMembers {
	private readonly dynamic_member_owners = new Set(['Reflect', 'Proxy']);
	private readonly dynamic_call_names = new Set(['Proxy']);
	private readonly object_value_rules = new ObjectValueRules();
	private readonly reflect_aliases = new TypeScriptExpressionAliases('Reflect');
	private readonly proxy_aliases = new TypeScriptExpressionAliases('Proxy');
	private readonly object_aliases = new TypeScriptExpressionAliases('Object');
	private readonly static_expression_values = new TypeScriptStaticExpressionValues();
	private readonly dynamic_object_aliases = new DynamicObjectMemberAliases();
	private readonly proxy_object_aliases = new DynamicObjectMemberAliases('Proxy');
	private readonly object_object_aliases = new DynamicObjectMemberAliases('Object');
	private readonly member_expressions = new DynamicRuntimeMemberExpressions();
	private readonly reflect_member_aliases = new TypeScriptMemberAliases(
		'Reflect',
		(expression, node) => this.static_expression_values.value(expression, node)
	);
	private readonly proxy_member_aliases = new TypeScriptMemberAliases(
		'Proxy',
		(expression, node) => this.static_expression_values.value(expression, node)
	);
	private readonly object_member_aliases = new TypeScriptMemberAliases(
		'Object',
		(expression, node) => this.static_expression_values.value(expression, node)
	);

	/** Responsibilities: _direct dynamic member identification_. **/
	private direct_member(expression: ts.Expression, source: ts.Node): boolean {
		if (this.dynamic_object_aliases.receiver(expression, source)) {
			return true;
		}
		if (this.proxy_object_aliases.receiver(expression, source)) {
			return true;
		}
		if (this.reflect_aliases.receiver(expression, source)) {
			return true;
		}
		return this.proxy_aliases.receiver(expression, source);
	}

	/** Responsibilities: _dynamic member ownership_. **/
	private owner_member(owner: ts.Expression, source: ts.Node): boolean {
		if (this.dynamic_member_owners.has(this.member_expressions.member_name(owner))) {
			return true;
		}
		if (this.dynamic_object_aliases.receiver(owner, source)) {
			return true;
		}
		if (this.proxy_object_aliases.receiver(owner, source)) {
			return true;
		}
		if (this.reflect_aliases.receiver(owner, source)) {
			return true;
		}
		return this.proxy_aliases.receiver(owner, source);
	}

	/** Responsibilities: _dynamic member identification_. **/
	private dynamic_member(expression: ts.Expression, source: ts.Node): boolean {
		if (this.direct_member(expression, source)) {
			return true;
		}
		for (const owner of this.member_expressions.member_owners(expression)) {
			if (this.owner_member(owner, source)) {
				return true;
			}
		}
		return false;
	}

	/** Responsibilities: _dynamic member alias classification_. **/
	private member_alias(expression: ts.Expression, node: ts.Node): boolean {
		if (this.reflect_member_aliases.member(expression, node)) {
			return true;
		}
		if (this.proxy_member_aliases.member(expression, node)) {
			return true;
		}
		return this.object_member_aliases.member(expression, node);
	}

	/** Responsibilities: _dynamic invocation identification_. **/
	private dynamic_invocation(expression: ts.Expression, node: ts.Node): boolean {
		if (ts.isIdentifier(expression)) {
			if (this.dynamic_call_names.has(expression.text)) {
				return true;
			}
			if (this.proxy_aliases.receiver(expression, node)) {
				return true;
			}
			return this.member_alias(expression, node);
		}
		return this.dynamic_member(expression, node);
	}

	/** Responsibilities: _own-property invocation identification_. **/
	private own_property_call(node: ts.Node): boolean {
		if (!ts.isCallExpression(node)) {
			return false;
		}
		if (this.object_value_rules.object_method(node)) {
			return true;
		}
		const expression = node.expression;
		if (ts.isPropertyAccessExpression(expression)) {
			return this.own_property_access(expression);
		}
		if (ts.isElementAccessExpression(expression)) {
			return this.own_element_access(expression);
		}
		return false;
	}

	/** Responsibilities: _property own-member identification_. **/
	private own_property_access(expression: ts.PropertyAccessExpression): boolean {
		if (this.object_aliases.member_name(expression) === 'hasOwn') {
			if (this.object_aliases.receiver(expression.expression, expression)) {
				return true;
			}
			return this.object_object_aliases.member(expression, expression, 'hasOwn');
		}
		return this.object_object_aliases.member(expression, expression, 'hasOwn');
	}

	/** Responsibilities: _element own-member identification_. **/
	private own_element_access(expression: ts.ElementAccessExpression): boolean {
		if (this.object_aliases.member_name(expression) === 'hasOwn') {
			if (this.object_aliases.receiver(expression.expression, expression)) {
				return true;
			}
			return this.object_object_aliases.member(expression, expression, 'hasOwn');
		}
		return this.object_object_aliases.member(expression, expression, 'hasOwn');
	}

	/** Responsibilities: _dynamic access identification_. **/
	private dynamic_access(node: ts.Node): boolean {
		if (!ts.isPropertyAccessExpression(node)) {
			if (!ts.isElementAccessExpression(node)) {
				return false;
			}
		}
		return this.dynamic_member(node, node);
	}

	/** Responsibilities: _dynamic property identification_. **/
	private dynamic_property(node: ts.Node): boolean {
		if (!ts.isPropertyAccessExpression(node)) {
			if (!ts.isElementAccessExpression(node)) {
				return false;
			}
		}
		if (this.property_parent_blocked(node)) {
			return false;
		}
		return this.dynamic_access(node);
	}

	/** Responsibilities: _nested property access exclusion_. **/
	private property_parent_blocked(node: ts.Node): boolean {
		if (ts.isCallExpression(node.parent)) {
			return true;
		}
		if (ts.isNewExpression(node.parent)) {
			return true;
		}
		if (ts.isPropertyAccessExpression(node.parent)) {
			return true;
		}
		return ts.isElementAccessExpression(node.parent);
	}

	/** Responsibilities: _dynamic runtime member usage_. **/
	public matches(node: ts.Node): boolean {
		if (this.own_property_call(node)) {
			return true;
		}
		if (ts.isCallExpression(node)) {
			return this.call(node);
		}
		if (ts.isNewExpression(node)) {
			return this.construct(node);
		}
		return this.dynamic_property(node);
	}

	/** Responsibilities: _dynamic member rule_. **/
	public call(node: ts.CallExpression): boolean {
		return this.dynamic_invocation(node.expression, node);
	}

	/** Responsibilities: _dynamic construction usage_. **/
	public construct(node: ts.NewExpression): boolean {
		return this.dynamic_invocation(node.expression, node);
	}
}
