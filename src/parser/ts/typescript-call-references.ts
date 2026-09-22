import { TypeScriptCallReference } from 'src/bridge/ts/parser/typescript-call-reference-builder';
import { TypeScriptCallExpressionInspector } from 'src/parser/ts/typescript-call-expression-inspector';
import ts from 'typescript';

import type { AstCallableReference } from 'src/types';
import type { TypeScriptSourceResolver } from 'src/model/types';
import { TypeScriptReferenceContext } from 'src/typescript-reference-context';


import type { CallTargetKind } from 'src/types';

/** Responsibilities: _TypeScript expressions collection traversal_. **/
export class TypeScriptCallReferenceCollector {
	private readonly source_file: ts.SourceFile;
	private readonly context: TypeScriptReferenceContext;
	private readonly references: AstCallableReference[] = [];
	private readonly expression_inspector = new TypeScriptCallExpressionInspector();

	/** Responsibilities: _node routing invocation traversal_. **/
	private visit_node(node: ts.Node, owner: string = ''): void {
		let current_owner = owner;
		if (ts.isClassDeclaration(node)) {
			if (node.name !== undefined) {
				current_owner = node.name.text;
			}
		} else if (ts.isClassExpression(node)) {
			if (node.name !== undefined) {
				current_owner = node.name.text;
			}
		}
		this.append_call_reference(node, current_owner);
		ts.forEachChild(node, child => this.visit_node(child, current_owner));
	}

	/** Responsibilities: _aggregation reference direct invocation_. **/
	private append_call_reference(node: ts.Node, owner: string = ''): void {
		const expressions = this.expression_inspector.direct_value_expression(node);
		if (expressions.length > 0) {
			this.append_value_expression(expressions[0], owner);
			return;
		}
		this.append_nested_node(node, owner);
	}

	/** Responsibilities: _nested node preservation traversal_. **/
	private append_nested_node(node: ts.Node, owner: string = ''): void {
		if (ts.isCallExpression(node)) {
			this.append_nested_values(node, owner);
			this.append_call_target(node, owner);
			return;
		}
		if (ts.isNewExpression(node)) {
			this.append_new_node(node, owner);
			return;
		}
		if (ts.isArrayLiteralExpression(node)) {
			this.append_nested_values(node, owner);
		}
	}

	/** Responsibilities: _aggregation constructor references inspection_. **/
	private append_new_node(node: ts.NewExpression, owner: string = ''): void {
		const call_reference_builder = new TypeScriptCallReference();

		this.append_nested_values(node, owner);
if (ts.isIdentifier(node.expression) || ts.isPropertyAccessExpression(node.expression)) {
			this.references.push(call_reference_builder.call_reference(this.source_file, this.context, node.expression));
		}
	}

	/** Responsibilities: _nested object values traversal_. **/
	private append_nested_values(
		node: ts.Node,
		owner: string = ''
	): void {
		if (ts.isArrayLiteralExpression(node)) {
			this.append_argument_values(node.elements, owner);
			return;
		}
		if (ts.isCallExpression(node) || ts.isNewExpression(node)) {
			if (node.arguments !== undefined) {
				this.append_argument_values(node.arguments, owner);
			}
		}
	}

	/** Responsibilities: _invocation argument expressions traversal_. **/
	private append_argument_values(arguments_list: readonly ts.Expression[], owner: string = ''): void {
		for (const argument of arguments_list) {
			if (ts.isSpreadElement(argument)) {
				this.append_value_expression(argument.expression, owner);
				continue;
			}
			this.append_value_expression(argument, owner);
		}
	}

	/** Responsibilities: _value expression collection traversal_. **/
	private append_value_expression(expression: ts.Expression, owner: string = ''): void {
		const call_reference_builder = new TypeScriptCallReference();

		if (ts.isIdentifier(expression)) {
			this.references.push(
				call_reference_builder.call_reference(this.source_file, this.context, expression, {
					current_owner: owner,
					is_bound: false,
					is_call: false,
				})
			);
			return;
		}
		if (ts.isPropertyAccessExpression(expression)) {
			this.references.push(
				call_reference_builder.call_reference(this.source_file, this.context, expression, {
					current_owner: owner,
					is_bound: false,
					is_call: false,
				})
			);
		}
	}

	/** Responsibilities: _aggregation callable target invocation_. **/
	private append_call_target(node: ts.CallExpression, owner: string = ''): void {
		const bound_expressions = this.expression_inspector.bind_target(node);
		if (bound_expressions.length > 0) {
			this.append_target(bound_expressions[0], 'bound', owner);
			return;
		}
if (ts.isIdentifier(node.expression) || ts.isPropertyAccessExpression(node.expression)) {
			this.append_target(node.expression, 'call', owner);
		}
	}

	/** Responsibilities: _aggregation resolution callable reference_. **/
	private append_target(
		expression: ts.Node,
		target_kind: CallTargetKind,
		owner: string = ''
	): void {
		const call_reference_builder = new TypeScriptCallReference();

		const options = { current_owner: owner, is_bound: false, is_call: false };
		if (target_kind === 'bound') {
			options.is_bound = true;
		} else {
			options.is_call = true;
		}
if (!ts.isIdentifier(expression) && !ts.isPropertyAccessExpression(expression)) {
			return;
		}
		this.references.push(call_reference_builder.call_reference(this.source_file, this.context, expression, options));
	}

	/** Responsibilities: _initialization source context callable-reference_. **/
	constructor(source_file: ts.SourceFile, ...resolvers: TypeScriptSourceResolver[]) {
		this.source_file = source_file;
		this.context = new TypeScriptReferenceContext(source_file, ...resolvers);
		this.context.initialize();
	}

	/** Responsibilities: _collection callable references source-file_. **/
	public collect(): AstCallableReference[] {
		this.collect_node(this.source_file);
		return this.references;
	}

	/** Responsibilities: _collection callable references AST_. **/
	public collect_node(node: ts.Node): AstCallableReference[] {
		const initial_count = this.references.length;
		this.visit_node(node);
		return this.references.slice(initial_count);
	}
}
