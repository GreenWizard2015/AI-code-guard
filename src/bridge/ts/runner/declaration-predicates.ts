import { ConstructorRules } from 'src/bridge/ts/runner/constructor-rules';
import { TypeScriptProxyExpressions } from 'src/bridge/ts/runner/proxy-expressions';
import { TypeScriptExpressionAliases } from 'src/typescript-aliases/typescript-expression-aliases';
import ts from 'typescript';

/** Responsibilities: _classification TypeScript declarations static_. **/
export class DeclarationPredicates {
	private readonly static_kind = ts.SyntaxKind.StaticKeyword;
	private readonly assignment_kind = ts.SyntaxKind.EqualsToken;
	private readonly object_aliases = new TypeScriptExpressionAliases('Object');
	private readonly reflect_aliases = new TypeScriptExpressionAliases('Reflect');

	/** Responsibilities: _classification method declaration static_. **/
	private has_static_method(node: ts.HasModifiers): boolean {
		const modifiers = ts.getModifiers(node);
		if (modifiers === undefined) {
			return false;
		}
		return modifiers.some(modifier => modifier.kind === this.static_kind);
	}

	/** Responsibilities: _classification assignment targets prototype_. **/
	private has_prototype_target(node: ts.Node): boolean {
		const proxy_expressions = new TypeScriptProxyExpressions();

if (!ts.isBinaryExpression(node) || node.operatorToken.kind !== this.assignment_kind) {
			return false;
		}
		if (!ts.isPropertyAccessExpression(node.left)) {
			return false;
		}
		return proxy_expressions.contains_property(node.left, 'prototype');
	}

	/** Responsibilities: _prototype mutation detection_. **/
	private prototype_call(node: ts.Node): boolean {
		if (!ts.isCallExpression(node) || !ts.isPropertyAccessExpression(node.expression)) {
			return false;
		}
		if (node.expression.name.text !== 'setPrototypeOf') {
			return false;
		}
		if (this.object_aliases.receiver(node.expression.expression, node)) {
			return true;
		}
		return this.reflect_aliases.receiver(node.expression.expression, node);
	}

	/** Responsibilities: _reporting static method field_. **/
	public static_declaration(node: ts.Node): boolean {
		if (ts.isMethodDeclaration(node)) {
			return this.has_static_method(node);
		}
		if (ts.isGetAccessor(node)) {
			return this.has_static_method(node);
		}
		if (ts.isSetAccessor(node)) {
			return this.has_static_method(node);
		}
		if (ts.isPropertyDeclaration(node)) {
			const modifiers = ts.getModifiers(node);
			if (modifiers === undefined) {
				return false;
			}
			return modifiers.some(modifier => modifier.kind === this.static_kind);
		}
		return false;
	}

	/** Responsibilities: _reporting assignments prototype members_. **/
	public prototype_assignment(node: ts.Node): boolean {
		if (this.prototype_call(node)) {
			return true;
		}
		if (!ts.isBinaryExpression(node)) {
			return false;
		}
		return this.has_prototype_target(node);
	}

	/** Responsibilities: _reporting method invocation temporary_. **/
	public temp_method(node: ts.Node): boolean {
if (!ts.isCallExpression(node) || !ts.isPropertyAccessExpression(node.expression)) {
			return false;
		}
		return ts.isNewExpression(node.expression.expression);
	}

	/** Responsibilities: _report constructor parameter properties_. **/
	public parameter_property(node: ts.Node): boolean {
if (!ts.isParameter(node) || !ts.isConstructorDeclaration(node.parent)) {
			return false;
		}
		return ts.isParameterPropertyDeclaration(node, node.parent);
	}

	/** Responsibilities: _reporting constructors complex initialization_. **/
	public complex_constructor(node: ts.Node): boolean {
		const constructor_rules = new ConstructorRules();

		if (!ts.isConstructorDeclaration(node) || !node.body) {
			return false;
		}
		return node.body.statements.some(statement => !constructor_rules.statement_allowed(statement));
	}
}
