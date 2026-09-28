import ts from 'typescript';
import { TypeScriptMemberAliases } from 'src/typescript-aliases/typescript-member-aliases';
import { TypeScriptExpressionAliases } from 'src/typescript-aliases/typescript-expression-aliases';
import { TypeScriptObjectAliases } from 'src/typescript-aliases/typescript-object-aliases';
import { TypeScriptStaticExpressionValues } from 'src/typescript-callable-aliases/typescript-static-expression-values';

/** Responsibilities: _classification console mocks assignments_. **/
export class ConsoleMock {
	private readonly mock_methods = new Set(['spyOn', 'stub']);
	private readonly assignment_methods = new Set(['fn', 'mock']);
	private readonly console_aliases = new TypeScriptMemberAliases('console', () => '');
	private readonly jest_aliases = new TypeScriptMemberAliases('jest', () => '');
	private readonly expression_aliases = new TypeScriptExpressionAliases('');
	private readonly static_expression_values = new TypeScriptStaticExpressionValues();

	/** Responsibilities: _source object aliases_. **/
	private object_aliases(source: ts.Node): TypeScriptObjectAliases {
		const aliases = new TypeScriptObjectAliases();
		const scopes: ts.Node[] = [];
		let current = source;
		while (!ts.isSourceFile(current)) {
			if (ts.isFunctionLike(current)) {
				scopes.push(current);
			}
			current = current.parent;
		}
		scopes.push(current);
		for (const scope of scopes.reverse()) {
			aliases.collect(scope);
		}
		return aliases;
	}

	/** Responsibilities: _static console member name_. **/
	private member_name(expression: ts.Expression, source: ts.Node): string {
		if (ts.isPropertyAccessExpression(expression)) {
			return expression.name.text;
		}
		if (!ts.isElementAccessExpression(expression) || expression.argumentExpression === undefined) {
			return '';
		}
		const key = this.expression_aliases.unwrapped(expression.argumentExpression);
		if (ts.isStringLiteral(key) || ts.isNoSubstitutionTemplateLiteral(key)) {
			return key.text;
		}
		return this.static_expression_values.value(expression.argumentExpression, source);
	}

	/** Responsibilities: _classification invocation invokes configuration_. **/
	private is_mock_call(node: ts.CallExpression): boolean {
		let method = this.member_name(node.expression, node);
		if (method === '') {
			if (!ts.isIdentifier(node.expression)) {
				return false;
			}
			if (!this.jest_aliases.property(node.expression, node, 'spyOn')) {
				return false;
			}
			method = 'spyOn';
		}
		if (!this.mock_methods.has(method)) {
			return false;
		}
		if (node.arguments.length === 0) {
			return false;
		}
		return this.console_expression(node.arguments[0], node);
	}

	/** Responsibilities: _classification assignment targets console_. **/
	private console_assignment(node: ts.BinaryExpression): boolean {
		if (node.operatorToken.kind !== ts.SyntaxKind.EqualsToken) {
			return false;
		}
		if (!this.console_assignment_target(node.left, node)) {
			return false;
		}
		return this.assignment_value_allowed(node.right, node);
	}

	/** Responsibilities: _classification left-hand side console_. **/
	private console_assignment_target(node: ts.Expression, source: ts.Node): boolean {
		if (!ts.isPropertyAccessExpression(node)) {
			return false;
		}
		return this.console_expression(node.expression, source);
	}

	/** Responsibilities: _classification console assignment value_. **/
	private assignment_value_allowed(node: ts.Expression, source: ts.Node): boolean {
		if (!ts.isCallExpression(node)) {
			return false;
		}
		const method = this.member_name(node.expression, source);
		if (method === '') {
			return false;
		}
		return this.assignment_methods.has(method);
	}

	/** Responsibilities: _classification node accesses console_. **/
	private is_console_property(node: ts.Node): boolean {
		if (!ts.isPropertyAccessExpression(node) && !ts.isElementAccessExpression(node)) {
			return false;
		}
		return this.console_expression(node.expression, node);
	}

	/** Responsibilities: _classification console property assignment_. **/
	private console_usage_assignment(node: ts.Node): boolean {
		if (!ts.isBinaryExpression(node)) {
			return false;
		}
		if (!ts.isPropertyAccessExpression(node.left) && !ts.isElementAccessExpression(node.left)) {
			return false;
		}
		return this.console_expression(node.left.expression, node);
	}

	/** Responsibilities: _classification console member alias_. **/
	private is_console_alias(node: ts.CallExpression): boolean {
		if (!ts.isIdentifier(node.expression)) {
			return false;
		}
		return this.console_aliases.member(node.expression, node);
	}

	/** Responsibilities: _reporting expression valid console_. **/
	public console_expression(node: ts.Expression, source: ts.Node): boolean {
		if (ts.isIdentifier(node)) {
			return node.text === 'console';
		}
		if (ts.isPropertyAccessExpression(node)) {
			if (ts.isIdentifier(node.expression) && node.expression.text === 'globalThis' && node.name.text === 'console') {
				return true;
			}
			const values = this.object_aliases(source).property_values(node.expression, node.name.text);
			return values.some(value => this.console_expression(value, source));
		}
		if (!ts.isElementAccessExpression(node) || !ts.isIdentifier(node.expression)) {
			return false;
		}
		if (node.expression.text !== 'globalThis' || node.argumentExpression === undefined) {
			return false;
		}
		return this.static_expression_values.value(node.argumentExpression, source) === 'console';
	}

	/** Responsibilities: _reporting node defines console_. **/
	public console_mock(node: ts.Node): boolean {
		if (ts.isCallExpression(node)) {
			return this.is_mock_call(node);
		}
		if (!ts.isBinaryExpression(node)) {
			return false;
		}
		return this.console_assignment(node);
	}

	/** Responsibilities: _reporting node performs disallowed_. **/
	public console_usage(node: ts.Node): boolean {
		if (ts.isCallExpression(node)) {
			if (this.is_console_property(node.expression)) {
				return true;
			}
			return this.is_console_alias(node);
		}
		return this.console_usage_assignment(node);
	}

}
