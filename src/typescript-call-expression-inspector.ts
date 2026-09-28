import ts from 'typescript';
import { TypeScriptExpressionAliases } from 'src/typescript-aliases/typescript-expression-aliases';
import { TypeScriptMemberAliases } from 'src/typescript-aliases/typescript-member-aliases';
import { TypeScriptStaticExpressionValues } from 'src/typescript-callable-aliases/typescript-static-expression-values';

/** Responsibilities: _unwrap TypeScript invocation expressions_. **/
export class TypeScriptCallExpressionInspector {
	private readonly bind_method_name = 'bind';
	private readonly expression_aliases = new TypeScriptExpressionAliases('');
	private readonly static_expression_values = new TypeScriptStaticExpressionValues();
	private readonly member_aliases = new TypeScriptMemberAliases(
		'*',
		(expression, node) => this.static_expression_values.value(expression, node)
	);

	/** Responsibilities: _unwrap nested bind invocation_. **/
	private unwrap_bind_context(expression: ts.Expression): ts.Expression {
		let current = expression;
		while (ts.isSatisfiesExpression(current)) {
			current = current.expression;
		}
		return current;
	}

	/** Responsibilities: _classification invocation expression usage_. **/
	private has_bind_context(node: ts.CallExpression): boolean {
		if (node.arguments.length === 0) {
			return false;
		}
		const argument = node.arguments[0];
		const context = this.unwrap_bind_context(argument);
		return !ts.isObjectLiteralExpression(context) && !ts.isArrayLiteralExpression(context);
	}

	/** Responsibilities: _resolution source expression represented_. **/
	private bind_source(expression: ts.Expression): ts.Node[] {
		const current = this.expression_aliases.unwrapped(expression);
		if (ts.isIdentifier(current) || ts.isPropertyAccessExpression(current)) {
			return [current];
		}
		if (!ts.isElementAccessExpression(current)) {
			return [];
		}
		const argument = current.argumentExpression;
		if (ts.isStringLiteral(argument) || ts.isNoSubstitutionTemplateLiteral(argument)) {
			return [current];
		}
		return [];
	}

	/** Responsibilities: _resolution direct values declared_. **/
	private declaration_value(node: ts.Node): ts.Expression[] {
		if (!ts.isVariableDeclaration(node) && !ts.isParameter(node)) {
			return [];
		}
		if (node.initializer !== undefined) {
			return [node.initializer];
		}
		return [];
	}

	/** Responsibilities: _resolution expressions output output_. **/
	private return_value(node: ts.ReturnStatement): ts.Expression[] {
		if (node.expression !== undefined) {
			return [node.expression];
		}
		return [];
	}

	/** Responsibilities: _bind member classification_. **/
	private bind_member(expression: ts.Expression, node: ts.Node): boolean {
		const current = this.expression_aliases.unwrapped(expression);
		if (ts.isIdentifier(current)) {
			return this.member_aliases.property(current, node, this.bind_method_name);
		}
		if (ts.isPropertyAccessExpression(current)) {
			return current.name.text === this.bind_method_name;
		}
		if (!ts.isElementAccessExpression(current) || current.argumentExpression === undefined) {
			return false;
		}
		return this.static_expression_values.value(current.argumentExpression, node) === this.bind_method_name;
	}

	/** Responsibilities: _element member chain resolution_. **/
	private element_member_chain(expression: ts.ElementAccessExpression): string[] {
		const argument = expression.argumentExpression;
		if (!ts.isStringLiteral(argument) && !ts.isNoSubstitutionTemplateLiteral(argument)) {
			return [];
		}
		const chain = this.static_member_chain(expression.expression);
		chain.push(argument.text);
		return chain;
	}

	/** Responsibilities: _named member chain resolution_. **/
	private named_member_chain(expression: ts.PropertyAccessExpression): string[] {
		const chain = this.static_member_chain(expression.expression);
		chain.push(expression.name.text);
		return chain;
	}

	/** Responsibilities: _static member chain resolution_. **/
	private static_member_chain(expression: ts.Expression): string[] {
		if (ts.isIdentifier(expression)) {
			return [expression.text];
		}
		if (ts.isPropertyAccessExpression(expression)) {
			return this.named_member_chain(expression);
		}
		if (ts.isElementAccessExpression(expression)) {
			return this.element_member_chain(expression);
		}
		return [];
	}

	/** Responsibilities: _Function bind invocation_. **/
	private function_bind_call(expression: ts.Expression): boolean {
		if (!ts.isPropertyAccessExpression(expression) || expression.name.text !== 'call') {
			return false;
		}
		return this.static_member_chain(expression.expression).join('.') === 'Function.prototype.bind';
	}

	/** Responsibilities: _collection direct value expressions_. **/
	public direct_value_expression(node: ts.Node): ts.Expression[] {
		if (ts.isPropertyAssignment(node)) {
			return [node.initializer];
		}
		if (ts.isVariableDeclaration(node) || ts.isParameter(node)) {
			return this.declaration_value(node);
		}
		if (ts.isReturnStatement(node)) {
			return this.return_value(node);
		}
		if (ts.isBinaryExpression(node)) {
			return [node.right];
		}
		return [];
	}

	/** Responsibilities: _bind usage classification_. **/
	public bind_call(node: ts.Node): boolean {
		if (!ts.isCallExpression(node)) {
			return false;
		}
		return this.bind_member(node.expression, node) || this.function_bind_call(node.expression);
	}

	/** Responsibilities: _resolution target callable expression_. **/
	public bind_target(node: ts.CallExpression): ts.Node[] {
		const expression = node.expression;
		if (!ts.isPropertyAccessExpression(expression) || expression.name.text !== this.bind_method_name) {
			return [];
		}
		if (!this.has_bind_context(node)) {
			return [];
		}
		return this.bind_source(expression.expression);
	}
}
