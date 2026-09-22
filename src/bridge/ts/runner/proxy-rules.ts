import { ProxyCall } from 'src/bridge/ts/runner/proxy-call';
import ts from 'typescript';


/** Responsibilities: _classification TypeScript proxy callables_. **/
export class ProxyRules {
	private readonly empty_arguments: readonly ts.Expression[] = [];
	private readonly proxy_call = new ProxyCall();

	/** Responsibilities: _collection parameter names callable_. **/
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

	/** Responsibilities: _classification invocation forwards callable_. **/
	private arguments_match(call: ts.Node, parameters: string[]): boolean {
		let arguments_list: readonly ts.Expression[] = this.empty_arguments;
		if (ts.isCallExpression(call) || ts.isNewExpression(call)) {
			if (call.arguments !== undefined) {
				arguments_list = call.arguments;
			}
		}
		if (arguments_list.length !== parameters.length) {
			return false;
		}
		const argument_names = this.identifier_names(arguments_list);
		if (argument_names.length !== parameters.length) {
			return false;
		}
		const parameter_names_sorted = [...parameters].sort();
		argument_names.sort();
		return parameter_names_sorted.every((parameter, index) => parameter === argument_names[index]);
	}

	/** Responsibilities: _extraction identifier names invocation_. **/
	private identifier_names(nodes: readonly ts.Expression[]): string[] {
		const names: string[] = [];
		for (const node of nodes) {
			const name = this.argument_root(node);
			if (name.length === 0) {
				return [];
			}
			names.push(name);
		}
		return names;
	}

	/** Responsibilities: _resolution root identifier argument_. **/
	private argument_root(node: ts.Expression): string {
		let current = node;
		while (ts.isPropertyAccessExpression(current)) {
			current = current.expression;
		}
		if (ts.isIdentifier(current)) {
			return current.text;
		}
		return '';
	}

	/** Responsibilities: _resolution callable target expression_. **/
	private target_expression(call: ts.Node): ts.Expression {
		if (ts.isCallExpression(call) || ts.isNewExpression(call)) {
			return call.expression;
		}
		if (ts.isPropertyAccessExpression(call)) {
			return call;
		}
		throw new Error('Unsupported proxy call expression.');
	}

	/** Responsibilities: _classification invocation targets this_. **/
	private this_call(call: ts.Node): boolean {
if (!ts.isCallExpression(call) || !ts.isPropertyAccessExpression(call.expression)) {
			return false;
		}
		return call.expression.expression.kind === ts.SyntaxKind.ThisKeyword;
	}

	/** Responsibilities: _collection property names TypeScript_. **/
	public property_chain(node: ts.Node): string[] {
		if (ts.isIdentifier(node)) {
			return [node.text];
		}
		if (!ts.isPropertyAccessExpression(node)) {
			return [];
		}
		const chain = this.property_chain(node.expression);
		chain.push(node.name.text);
		return chain;
	}

	/** Responsibilities: _reporting callable declaration forwards_. **/
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
		return this.arguments_match(call, parameters);
	}

	/** Responsibilities: _reporting arrow function expression_. **/
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
