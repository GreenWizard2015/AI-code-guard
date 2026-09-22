import ts from 'typescript';

/** Responsibilities: _classification object string invocation_. **/
export class ObjectValueRules {
	private readonly object_name = 'Object';
	private readonly prototype_name = 'prototype';
	private readonly call_name = 'call';

	/** Responsibilities: _classification expression invocation object_. **/
	private object_string_call(expression: ts.Expression): boolean {
		if (!ts.isPropertyAccessExpression(expression)) {
			return false;
		}
		if (expression.name.text !== 'toString') {
			return false;
		}
		return this.object_prototype(expression.expression);
	}

	/** Responsibilities: _classification expression accesses object_. **/
	private object_prototype(expression: ts.Expression): boolean {
		if (!ts.isPropertyAccessExpression(expression)) {
			return false;
		}
		if (expression.name.text !== this.prototype_name) {
			return false;
		}
		if (!ts.isIdentifier(expression.expression)) {
			return false;
		}
		return expression.expression.text === this.object_name;
	}

	/** Responsibilities: _classification expression forms disallowed_. **/
	private object_chain(node: ts.Expression): boolean {
		if (ts.isIdentifier(node)) {
			return node.text === this.object_name;
		}
		if (!ts.isPropertyAccessExpression(node)) {
			return false;
		}
		return this.object_chain(node.expression);
	}

	/** Responsibilities: _reporting object string operations_. **/
	public object_string(node: ts.Node): boolean {
if (!ts.isCallExpression(node) || !ts.isPropertyAccessExpression(node.expression)) {
			return false;
		}
		return this.object_string_call(node.expression.expression);
	}

	/** Responsibilities: _reporting object assignment operations_. **/
	public object_assign(node: ts.Node): boolean {
if (!ts.isCallExpression(node) || !ts.isPropertyAccessExpression(node.expression)) {
			return false;
		}
		const target = node.expression.expression;
if (!ts.isIdentifier(target) || target.text !== this.object_name) {
			return false;
		}
		return node.expression.name.text === 'assign';
	}

	/** Responsibilities: _reporting object method operations_. **/
	public object_method(node: ts.Node): boolean {
if (!ts.isCallExpression(node) || !ts.isPropertyAccessExpression(node.expression)) {
			return false;
		}
		if (node.expression.name.text !== this.call_name) {
			return false;
		}
		return this.object_chain(node.expression.expression);
	}
}
