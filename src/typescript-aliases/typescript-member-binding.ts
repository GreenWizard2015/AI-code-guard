import ts from 'typescript';
import { TypeScriptExpressionAliases } from 'src/typescript-aliases/typescript-expression-aliases';
import { TypeScriptMemberVariableAliases } from 'src/typescript-aliases/typescript-member-variable-aliases';

/** Responsibilities: _collection TypeScript member bindings_. **/
export class TypeScriptMemberBinding {
	private readonly target_aliases: TypeScriptExpressionAliases;
	private readonly variable_aliases: TypeScriptMemberVariableAliases;
	private readonly static_value: (expression: ts.Expression, node: ts.Node) => string;

	/** Responsibilities: _member expression unwrapping_. **/
	private unwrap(expression: ts.Expression): ts.Expression {
		let current = expression;
		while (ts.isAsExpression(current) || ts.isTypeAssertionExpression(current)) {
			current = current.expression;
		}
		while (ts.isParenthesizedExpression(current)) {
			current = current.expression;
		}
		return current;
	}

	/** Responsibilities: _member alias insertion_. **/
	private add(aliases: Map<string, Set<string>>, name: string, property: string): boolean {
		if (name === '' || property === '') {
			return false;
		}
		const existing = aliases.get(name);
		let properties: Set<string>;
		if (existing === undefined) {
			properties = new Set<string>();
		} else {
			properties = existing;
		}
		if (properties.has(property)) {
			return false;
		}
		properties.add(property);
		aliases.set(name, properties);
		return true;
	}

	/** Responsibilities: _known member aliases_. **/
	private known(aliases: Map<string, Set<string>>, name: string, value: ts.Identifier): boolean {
		const properties = aliases.get(value.text);
		if (properties === undefined) {
			return false;
		}
		let changed = false;
		for (const property of properties) {
			if (this.add(aliases, name, property)) {
				changed = true;
			}
		}
		return changed;
	}

	/** Responsibilities: _source member aliases_. **/
	private source(
		aliases: Map<string, Set<string>>,
		name: string,
		value: ts.Expression,
		node: ts.Node
	): boolean {
		if (!ts.isPropertyAccessExpression(value) && !ts.isElementAccessExpression(value)) {
			return false;
		}
		if (!this.target_aliases.receiver(value.expression, node)) {
			return false;
		}
		return this.add(aliases, name, this.member_name(value, node));
	}

	/** Responsibilities: _member value aliases_. **/
	private value(
		aliases: Map<string, Set<string>>,
		name: string,
		initializer: ts.Expression,
		node: ts.Node
	): boolean {
		if (name === '') {
			return false;
		}
		const value = this.unwrap(initializer);
		if (ts.isIdentifier(value)) {
			return this.known(aliases, name, value);
		}
		return this.source(aliases, name, value, node);
	}

	/** Responsibilities: _scope member aliases_. **/
	private visit(aliases: Map<string, Set<string>>, node: ts.Node, root: ts.Node): boolean {
		if (node !== root && ts.isFunctionLike(node)) {
			return false;
		}
		let changed = false;
		if (ts.isVariableDeclaration(node)) {
			if (this.variable_aliases.append(aliases, node)) {
				changed = true;
			}
		}
		node.forEachChild(child => {
			if (this.visit(aliases, child, root)) {
				changed = true;
			}
		});
		return changed;
	}

	/** Responsibilities: _member binding initialization_. **/
	public constructor(
		target_name: string,
		static_value: (expression: ts.Expression, node: ts.Node) => string
	) {
		this.target_aliases = new TypeScriptExpressionAliases(target_name);
		this.static_value = static_value;
		this.variable_aliases = new TypeScriptMemberVariableAliases(
			this.target_aliases,
			(aliases, name, property) => this.add(aliases, name, property),
			(aliases, name, initializer, node) => this.value(aliases, name, initializer, node),
			expression => this.unwrap(expression)
		);
	}

	/** Responsibilities: _member expression name_. **/
	public member_name(expression: ts.Expression, source: ts.Node): string {
		if (ts.isPropertyAccessExpression(expression)) {
			return expression.name.text;
		}
		if (!ts.isElementAccessExpression(expression)) {
			return '';
		}
		const argument = expression.argumentExpression;
		if (argument === undefined) {
			return '';
		}
		if (ts.isStringLiteral(argument) || ts.isNoSubstitutionTemplateLiteral(argument)) {
			return argument.text;
		}
		return this.static_value(argument, source);
	}

	/** Responsibilities: _member alias collection_. **/
	public collect(scope: ts.Node): Map<string, Set<string>> {
		const aliases = new Map<string, Set<string>>();
		let changed = true;
		while (changed) {
			changed = this.visit(aliases, scope, scope);
		}
		return aliases;
	}
}
