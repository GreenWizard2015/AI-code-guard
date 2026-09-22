import ts from 'typescript';
import type { RuleContextData } from 'src/types';
import { DYNAMIC_RUNTIME_USAGE } from 'src/bridge/ts/parser-internals/constants';
import { DynamicBindingNames } from 'src/bridge/ts/parser-internals/dynamic-binding-names';

/** Responsibilities: _detection dynamic runtime access_. **/
export class DynamicRuntimeUsage {
	private readonly dynamic_member_owners = new Set(['Reflect', 'Proxy']);
	private readonly dynamic_call_names = new Set(['Proxy']);
	private readonly binding_names = new DynamicBindingNames();

	/** Responsibilities: _identification runtime expression name_. **/
	private expression_name(expression: ts.Expression): string {
		if (ts.isIdentifier(expression)) {
			return expression.text;
		}
		if (!ts.isPropertyAccessExpression(expression)) {
			return '';
		}
		if (!ts.isIdentifier(expression.expression)) {
			return '';
		}
		if (expression.expression.text === 'globalThis') {
			return expression.name.text;
		}
		return '';
	}

	/** Responsibilities: _dynamic runtime members identification_. **/
	private is_dynamic_member(expression: ts.Expression): boolean {
		if (!ts.isPropertyAccessExpression(expression)) {
			return false;
		}
		return this.dynamic_member_owners.has(this.expression_name(expression.expression));
	}

	/** Responsibilities: _dynamic runtime invocations identification_. **/
	private dynamic_invocation(node: ts.Node): boolean {
		if (!ts.isCallExpression(node) && !ts.isNewExpression(node)) {
			return false;
		}
		const expression = node.expression;
		if (ts.isIdentifier(expression)) {
			return this.dynamic_call_names.has(expression.text);
		}
		return this.is_dynamic_member(expression);
	}

	/** Responsibilities: _identification own-property invocation_. **/
	private own_property_call(node: ts.Node): boolean {
		if (!ts.isCallExpression(node)) {
			return false;
		}
		if (!ts.isPropertyAccessExpression(node.expression)) {
			return false;
		}
		const call = node.expression;
		if (call.name.text === 'hasOwn') {
			return this.object_has_own(call);
		}
		if (call.name.text !== 'call') {
			return false;
		}
		return this.prototype_has_own(call);
	}

	/** Responsibilities: _identification Object hasOwn invocation_. **/
	private object_has_own(call: ts.PropertyAccessExpression): boolean {
		if (!ts.isIdentifier(call.expression)) {
			return false;
		}
		return call.expression.text === 'Object';
	}

	/** Responsibilities: _identification prototype hasOwnProperty invocation_. **/
	private prototype_has_own(call: ts.PropertyAccessExpression): boolean {
		if (!ts.isPropertyAccessExpression(call.expression)) {
			return false;
		}
		const property = call.expression;
		return this.prototype_property(property);
	}

	/** Responsibilities: _prototype property access identification_. **/
	private prototype_property(property: ts.PropertyAccessExpression): boolean {
		if (property.name.text !== 'hasOwnProperty') {
			return false;
		}
		if (!ts.isPropertyAccessExpression(property.expression)) {
			return false;
		}
		const prototype = property.expression;
		return this.object_prototype(prototype);
	}

	/** Responsibilities: _Object.prototype access identification_. **/
	private object_prototype(prototype: ts.PropertyAccessExpression): boolean {
		if (prototype.name.text !== 'prototype') {
			return false;
		}
		if (!ts.isIdentifier(prototype.expression)) {
			return false;
		}
		return prototype.expression.text === 'Object';
	}

	/** Responsibilities: _dynamic property access identification_. **/
	private dynamic_access(node: ts.Node): boolean {
		if (!ts.isPropertyAccessExpression(node)) {
			return false;
		}
		return this.is_dynamic_member(node);
	}

	/** Responsibilities: _dynamic property access_. **/
	private dynamic_property(node: ts.Node): boolean {
		if (!ts.isPropertyAccessExpression(node)) {
			return false;
		}
		if (ts.isCallExpression(node.parent)) {
			return false;
		}
		if (ts.isNewExpression(node.parent)) {
			return false;
		}
		return this.dynamic_access(node);
	}

	/** Responsibilities: _dynamic in-operator usage identification_. **/
	public in_operator(node: ts.IfStatement, source_file: ts.SourceFile): boolean {
		const expression = node.expression;
		if (!ts.isBinaryExpression(expression)) {
			return false;
		}
		if (expression.operatorToken.kind !== ts.SyntaxKind.InKeyword) {
			return false;
		}
		const right = expression.right;
		return !this.binding_names.collection(right, source_file);
	}

	/** Responsibilities: _dynamic runtime usage identification_. **/
	public dynamic(node: ts.Node, source_file: ts.SourceFile): boolean {
		if (this.own_property_call(node)) {
			return true;
		}
		if (ts.isCallExpression(node) || ts.isNewExpression(node)) {
			return this.dynamic_invocation(node);
		}
		if (this.binding_names.dynamic_key(node, source_file)) {
			return true;
		}
		return this.dynamic_property(node);
	}

	/** Responsibilities: _dynamic runtime rules addition_. **/
	public append_rule(node: ts.Node, context: RuleContextData): void {
		if (this.dynamic(node, context.source_file)) {
			context.append_rule(node, DYNAMIC_RUNTIME_USAGE);
		}
	}
}
