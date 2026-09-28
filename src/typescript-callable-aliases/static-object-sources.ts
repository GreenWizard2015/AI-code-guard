import ts from 'typescript';
import { TypeScriptExpressionAliases } from 'src/typescript-aliases/typescript-expression-aliases';
import { TypeScriptMemberAliases } from 'src/typescript-aliases/typescript-member-aliases';
import { TypeScriptStaticExpressionValues } from 'src/typescript-callable-aliases/typescript-static-expression-values';
import type { TypeScriptStaticObjectArgumentsProtocol } from 'src/protocols';

/** Responsibilities: _static object source collection_. **/
export class TypeScriptStaticObjectSources {
	private readonly expression_aliases = new TypeScriptExpressionAliases('');
	private readonly object_aliases = new TypeScriptExpressionAliases('Object');
	private readonly object_member_aliases = new TypeScriptMemberAliases('Object', () => '');
	private readonly static_values = new TypeScriptStaticExpressionValues();
	private readonly arguments_source: TypeScriptStaticObjectArgumentsProtocol;

	/** Responsibilities: _static object member names_. **/
	private member_name(expression: ts.Expression, node: ts.Node): string {
		const direct = this.object_aliases.member_name(expression);
		if (direct !== '') {
			return direct;
		}
		if (!ts.isElementAccessExpression(expression) || expression.argumentExpression === undefined) {
			return '';
		}
		return this.static_values.value(expression.argumentExpression, node);
	}

	/** Responsibilities: _branch operator classification_. **/
	private is_branch_operator(kind: ts.SyntaxKind): boolean {
		if (kind === ts.SyntaxKind.AmpersandAmpersandToken) {
			return true;
		}
		if (kind === ts.SyntaxKind.BarBarToken) {
			return true;
		}
		if (kind === ts.SyntaxKind.QuestionQuestionToken) {
			return true;
		}
		return kind === ts.SyntaxKind.CommaToken;
	}

	/** Responsibilities: _Object.assign invocation classification_. **/
	private is_object_assign(expression: ts.CallExpression): boolean {
		if (ts.isIdentifier(expression.expression)) {
			return this.object_member_aliases.property(expression.expression, expression, 'assign');
		}
		const member = expression.expression;
		if (!ts.isPropertyAccessExpression(member)) {
			if (!ts.isElementAccessExpression(member)) {
				return false;
			}
		}
		if (this.member_name(member, expression) !== 'assign') {
			return false;
		}
		return this.object_aliases.receiver(member.expression, expression);
	}

	/** Responsibilities: _Object.assign argument source_. **/
	private append_argument_source(
		properties: ts.ObjectLiteralElementLike[],
		argument: ts.Expression
	): boolean {
		if (!ts.isSpreadElement(argument)) {
			return this.append_properties(properties, argument);
		}
		return this.arguments_source.append_spread(
			argument,
			value => this.append_properties(properties, value)
		);
	}

	/** Responsibilities: _Object.assign source branches_. **/
	private append_call_source(properties: ts.ObjectLiteralElementLike[], initializer: ts.CallExpression): boolean {
		if (!this.is_object_assign(initializer)) {
			return false;
		}
		let found = false;
		for (const argument of initializer.arguments) {
			if (this.append_argument_source(properties, argument)) {
				found = true;
			}
		}
		return found;
	}

	/** Responsibilities: _binary object branches_. **/
	private append_binary_source(properties: ts.ObjectLiteralElementLike[], initializer: ts.BinaryExpression): boolean {
		if (!this.is_branch_operator(initializer.operatorToken.kind)) {
			return false;
		}
		let found = this.append_properties(properties, initializer.left);
		if (this.append_properties(properties, initializer.right)) {
			found = true;
		}
		return found;
	}

	/** Responsibilities: _conditional object branches_. **/
	private append_conditional_source(properties: ts.ObjectLiteralElementLike[], initializer: ts.ConditionalExpression): boolean {
		let found = this.append_properties(properties, initializer.whenTrue);
		if (this.append_properties(properties, initializer.whenFalse)) {
			found = true;
		}
		return found;
	}

	/** Responsibilities: _conditional binding branches_. **/
	private append_conditional_binding(
		initializer: ts.ConditionalExpression,
		append_branch: (expression: ts.Expression) => boolean
	): boolean {
		let found = append_branch(initializer.whenTrue);
		if (append_branch(initializer.whenFalse)) {
			found = true;
		}
		return found;
	}

	/** Responsibilities: _binary binding branches_. **/
	private append_binary_binding(
		initializer: ts.BinaryExpression,
		append_branch: (expression: ts.Expression) => boolean
	): boolean {
		if (!this.is_branch_operator(initializer.operatorToken.kind)) {
			return false;
		}
		let found = append_branch(initializer.left);
		if (append_branch(initializer.right)) {
			found = true;
		}
		return found;
	}

	/** Responsibilities: _Object.assign binding branches_. **/
	private append_call_binding(
		initializer: ts.CallExpression,
		append_branch: (expression: ts.Expression) => boolean
	): boolean {
		if (!this.is_object_assign(initializer)) {
			return false;
		}
		let found = false;
		for (const argument of initializer.arguments) {
			let changed = false;
			if (ts.isSpreadElement(argument)) {
				changed = this.arguments_source.append_spread(argument, append_branch);
			} else {
				changed = append_branch(argument);
			}
			if (changed) {
				found = true;
			}
		}
		return found;
	}

	/** Responsibilities: _static object source dependencies_. **/
	public constructor(arguments_source: TypeScriptStaticObjectArgumentsProtocol) {
		this.arguments_source = arguments_source;
	}

	/** Responsibilities: _object source branches_. **/
	public append_properties(properties: ts.ObjectLiteralElementLike[], initializer: ts.Expression): boolean {
		const current = this.expression_aliases.unwrapped(initializer);
		if (ts.isObjectLiteralExpression(current)) {
			properties.push(...current.properties);
			return true;
		}
		if (ts.isConditionalExpression(current)) {
			return this.append_conditional_source(properties, current);
		}
		if (ts.isCallExpression(current)) {
			return this.append_call_source(properties, current);
		}
		if (ts.isBinaryExpression(current)) {
			return this.append_binary_source(properties, current);
		}
		return false;
	}

	/** Responsibilities: _expression binding branches_. **/
	public append_binding(
		initializer: ts.Expression,
		append_branch: (expression: ts.Expression) => boolean
	): boolean {
		const current = this.expression_aliases.unwrapped(initializer);
		if (ts.isConditionalExpression(current)) {
			return this.append_conditional_binding(current, append_branch);
		}
		if (ts.isBinaryExpression(current)) {
			return this.append_binary_binding(current, append_branch);
		}
		if (ts.isCallExpression(current)) {
			return this.append_call_binding(current, append_branch);
		}
		return false;
	}

	/** Responsibilities: _object source registration_. **/
	public append_source(
		objects: Map<string, ts.ObjectLiteralExpression>,
		name: string,
		initializer: ts.Expression
	): boolean {
		if (objects.has(name)) {
			return false;
		}
		const properties: ts.ObjectLiteralElementLike[] = [];
		if (!this.append_properties(properties, initializer) || properties.length === 0) {
			return false;
		}
		objects.set(name, ts.factory.createObjectLiteralExpression(properties));
		return true;
	}
}
