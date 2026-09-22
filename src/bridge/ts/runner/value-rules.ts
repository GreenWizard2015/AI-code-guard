import { FakeObject } from 'src/bridge/ts/runner/fake-object';
import { ObjectValueRules } from 'src/bridge/ts/runner/object-value-rules';
import ts from 'typescript';
import { TypeScriptTypeNode } from 'src/model/typescript-type-node';




import type { RuleAppender, ValueRule } from 'src/bridge/ts/runner/types';

/** Responsibilities: _classification primitive values typeof_. **/
export class ValueRules {
	private readonly rule_ids = {
		structured: 'multiple-result-shapes',
		object_to_string: 'typescript-object-prototype-string',
		object_assign: 'typescript-object-assign',
		object_method_call: 'typescript-object-method-call',
		fake_object: 'typescript-fake-object',
	};

	/** Responsibilities: _selection value rules applicable_. **/
	private value_rules(node: ts.Node, test_file: boolean): ValueRule[] {
		const object_value_rules = new ObjectValueRules();
		const fake_object = new FakeObject();

		return [
			{ condition: ts.isIdentifier(node) && ['structuredContent', 'unwrap_tool_result'].includes(node.text), rule_id: this.rule_ids.structured },
			{ condition: object_value_rules.object_string(node), rule_id: this.rule_ids.object_to_string },
			{ condition: object_value_rules.object_assign(node), rule_id: this.rule_ids.object_assign },
			{ condition: object_value_rules.object_method(node) && !object_value_rules.object_string(node), rule_id: this.rule_ids.object_method_call },
			{ condition: !test_file && fake_object.fake_object(node), rule_id: this.rule_ids.fake_object },
		];
	}

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
	private variable_type(statement: ts.Statement, name: string): boolean {
		if (!ts.isVariableStatement(statement)) {
			return false;
		}
		return statement.declarationList.declarations.some(declaration => {
			if (!ts.isIdentifier(declaration.name) || declaration.name.text !== name) {
				return false;
			}
			if (declaration.type === undefined) {
				return false;
			}
			const type_node = new TypeScriptTypeNode(declaration.type);
			return type_node.primitive();
		});
	}

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
		if ((!ts.isIdentifier(node.name)) || node.name.text !== name || node.type === undefined) {
			return false;
		}
		const type_node = new TypeScriptTypeNode(node.type);
		return type_node.primitive();
	}

	/** Responsibilities: _aggregation value diagnostics selection_. **/
	public append_value_rules(node: ts.Node, test_file: boolean, append_rule: RuleAppender): void {
		for (const rule of this.value_rules(node, test_file)) {
			if (rule.condition) {
				append_rule(node, rule.rule_id);
			}
		}
	}

	/** Responsibilities: _reporting repeated typeof checks_. **/
	public repeated_typeof(node: ts.TypeOfExpression): boolean {
		let owner: ts.Node | undefined = node.parent;
		while (owner !== undefined && !ts.isFunctionLike(owner)) {
			owner = owner.parent;
		}
		if (owner === undefined || (!('body' in owner)) || (!owner.body)) {
			return false;
		}
		return this.count_typeof_expressions(owner) > 1;
	}

	/** Responsibilities: _reporting primitive type operations_. **/
	public typed_primitive(
		expression: ts.Expression,
		source_file: ts.SourceFile
	): boolean {
		if (ts.isParenthesizedExpression(expression)) {
			return this.typed_primitive(expression.expression, source_file);
		}
		if (ts.isIdentifier(expression)) {
			return source_file.statements.some(statement =>
				this.variable_type(statement, expression.text)
			);
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
		const expression_name = node.expression.text;
		return expression_name === 'type';
	}
}
