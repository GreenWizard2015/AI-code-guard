import ts from "typescript";
import { TypeScriptExpressionAliasCollector } from "src/typescript-aliases/typescript-expression-alias-collector";

/** Responsibilities: _resolution TypeScript expression aliases_. **/
export class TypeScriptExpressionAliases {
	private readonly target_name: string;
	private readonly collector: TypeScriptExpressionAliasCollector;
	private readonly scope_aliases = new WeakMap<ts.Node, ReadonlySet<string>>();

	/** Responsibilities: _globalThis target classification_. **/
	private matches_global_target(expression: ts.Expression): boolean {
		if (ts.isElementAccessExpression(expression)) {
			if (!ts.isIdentifier(expression.expression) || expression.expression.text !== "globalThis") {
				return false;
			}
			const argument = expression.argumentExpression;
			if (!ts.isStringLiteral(argument) && !ts.isNoSubstitutionTemplateLiteral(argument)) {
				return false;
			}
			return argument.text === this.target_name;
		}
		if (!ts.isPropertyAccessExpression(expression)) {
			return false;
		}
		if (!ts.isIdentifier(expression.expression) || expression.expression.text !== "globalThis") {
			return false;
		}
		return expression.name.text === this.target_name;
	}

	/** Responsibilities: _alias target classification_. **/
	private matches_target(expression: ts.Expression): boolean {
		if (this.target_name === "*") {
			return true;
		}
		if (this.target_name === "this") {
			return expression.kind === ts.SyntaxKind.ThisKeyword;
		}
		if (!ts.isIdentifier(expression)) {
			return this.matches_global_target(expression);
		}
		return expression.text === this.target_name;
	}

	/** Responsibilities: _target alias extension_. **/
	private append_target_alias(aliases: Set<string>, name: string): boolean {
		if (aliases.has(name)) {
			return false;
		}
		aliases.add(name);
		return true;
	}

	/** Responsibilities: _named alias extension_. **/
	private append_named_alias(aliases: Set<string>, name: string, value: ts.Identifier): boolean {
		if (!aliases.has(value.text)) {
			return false;
		}
		if (aliases.has(name)) {
			return false;
		}
		aliases.add(name);
		return true;
	}

	/** Responsibilities: _transparent expression child access_. **/
	private transparent_child(expression: ts.Expression): ts.Expression {
		if (ts.isAwaitExpression(expression)) {
			return expression.expression;
		}
		if (ts.isParenthesizedExpression(expression)) {
			return expression.expression;
		}
		if (ts.isNonNullExpression(expression)) {
			return expression.expression;
		}
		if (ts.isAsExpression(expression) || ts.isTypeAssertionExpression(expression)) {
			return expression.expression;
		}
		if (ts.isSatisfiesExpression(expression)) {
			return expression.expression;
		}
		return expression;
	}

	/** Responsibilities: _cached aliases by scope_. **/
	private cached_aliases(scope: ts.Node): ReadonlySet<string> {
		const cached = this.scope_aliases.get(scope);
		if (cached !== undefined) {
			return cached;
		}
		const aliases = this.collector.collect(scope);
		this.scope_aliases.set(scope, aliases);
		return aliases;
	}

	/** Responsibilities: _expression alias resolver initialization_. **/
	public constructor(target_name: string) {
		this.target_name = target_name;
		this.collector = new TypeScriptExpressionAliasCollector(this);
	}

	/** Responsibilities: _expression alias chain extension_. **/
	public append_alias(aliases: Set<string>, name: string, initializer: ts.Expression): boolean {
		const value = this.unwrapped(initializer);
		if (this.matches_target(value)) {
			return this.append_target_alias(aliases, name);
		}
		if (!ts.isIdentifier(value)) {
			return false;
		}
		return this.append_named_alias(aliases, name, value);
	}

	/** Responsibilities: _expression alias names resolution_. **/
	public names(node: ts.Node): ReadonlySet<string> {
		const names = new Set<string>();
		let current = node;
		while (!ts.isSourceFile(current)) {
			if (ts.isFunctionLike(current)) {
				for (const name of this.cached_aliases(current)) {
					names.add(name);
				}
			}
			current = current.parent;
		}
		for (const name of this.cached_aliases(current)) {
			names.add(name);
		}
		return names;
	}

	/** Responsibilities: _expression receiver classification_. **/
	public receiver(expression: ts.Expression, node: ts.Node): boolean {
		const current = this.unwrapped(expression);
		if (this.matches_target(current)) {
			return true;
		}
		if (!ts.isIdentifier(current)) {
			return false;
		}
		return this.names(node).has(current.text);
	}

	/** Responsibilities: _static member name resolution_. **/
	public member_name(expression: ts.Expression): string {
		if (ts.isPropertyAccessExpression(expression)) {
			return expression.name.text;
		}
		if (!ts.isElementAccessExpression(expression)) {
			return "";
		}
		const argument = expression.argumentExpression;
		if (argument === undefined) {
			return "";
		}
		const key = this.unwrapped(argument);
		if (ts.isStringLiteral(key) || ts.isNoSubstitutionTemplateLiteral(key)) {
			return key.text;
		}
		return "";
	}

	/** Responsibilities: _alias initializer unwrapping_. **/
	public unwrapped(expression: ts.Expression): ts.Expression {
		let current = expression;
		let child = this.transparent_child(current);
		while (child !== current) {
			current = child;
			child = this.transparent_child(current);
		}
		return current;
	}
}
