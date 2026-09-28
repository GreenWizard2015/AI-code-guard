import { ProxyCall } from 'src/bridge/ts/parser-internals/proxy-rules/proxy-call';
import { ProxyArgumentMatcher } from 'src/bridge/ts/parser-internals/proxy-rules/proxy-argument-matcher';
import ts from 'typescript';
import { TypeScriptExpressionAliases } from 'src/typescript-aliases/typescript-expression-aliases';
import { TypeScriptMemberAliases } from 'src/typescript-aliases/typescript-member-aliases';

/** Responsibilities: _TypeScript proxy callable classification_. **/
export class ProxyRules {
	private readonly proxy_call = new ProxyCall();
	private readonly argument_matcher = new ProxyArgumentMatcher();
	private readonly expression_aliases = new TypeScriptExpressionAliases('');
	private readonly this_aliases = new TypeScriptMemberAliases('this', () => '');

	/** Responsibilities: _parameter name collection_. **/
	private parameter_names(node: ts.Node): string[] {
		if (!ts.isFunctionLike(node)) {
			return [];
		}
		const identifiers = node.parameters.map(parameter => parameter.name).filter(ts.isIdentifier);
		if (identifiers.length !== node.parameters.length) {
			return [];
		}
		return identifiers.map(identifier => identifier.text);
	}

	/** Responsibilities: _callable target expression_. **/
	private target_expression(call: ts.Node): ts.Expression {
		if (ts.isCallExpression(call)) {
			return call.expression;
		}
		if (ts.isNewExpression(call)) {
			return call.expression;
		}
		if (ts.isPropertyAccessExpression(call)) {
			return call;
		}
		throw new Error('Unsupported proxy call expression.');
	}

	/** Responsibilities: _this-target classification_. **/
	private this_call(call: ts.Node): boolean {
		if (!ts.isCallExpression(call)) {
			return false;
		}
		const expression = this.expression_aliases.unwrapped(call.expression);
		if (ts.isPropertyAccessExpression(expression)) {
			return expression.expression.kind === ts.SyntaxKind.ThisKeyword;
		}
		if (!ts.isIdentifier(expression)) {
			return false;
		}
		return this.this_aliases.member(expression, call);
	}

	/** Responsibilities: _callable declaration forwarding_. **/
	public proxy_callable(node: ts.Node): boolean {
		const calls = this.proxy_call.proxy_call(node);
		if (calls.length === 0) {
			return false;
		}
		const call = calls[0];
		const target_expression = this.target_expression(call);
		if (!this.proxy_call.supports_target_expression(target_expression)) {
			return false;
		}
		const parameters = this.parameter_names(node);
		return this.argument_matcher.matches(call, parameters);
	}

	/** Responsibilities: _proxy lambda forwarding_. **/
	public proxy_lambda(node: ts.Node): boolean {
		if (!ts.isArrowFunction(node) && !ts.isFunctionExpression(node)) {
			return false;
		}
		const parent = node.parent;
		if (!ts.isPropertyAssignment(parent) || parent.initializer !== node) {
			return false;
		}
		const calls = this.proxy_call.proxy_call(node);
		if (calls.length === 0) {
			return false;
		}
		const call = calls[0];
		if (!this.this_call(call)) {
			return false;
		}
		return this.proxy_callable(node);
	}
}
