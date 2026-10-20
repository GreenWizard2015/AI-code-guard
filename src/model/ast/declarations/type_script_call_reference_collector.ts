import { TypeScriptCallReference } from "src/model/ast/declarations/type_script_call_reference";
import { TypeScriptCallExpressionInspector } from "src/parser/analysis/type_script_call_expression_inspector";
import ts from "typescript";

import type { AstCallableReference } from "src/types";
import { TypeScriptReferenceOwnership } from "src/parser/references/identity/references/type_script_reference_ownership";

import type { CallTargetKind } from "src/types";
import type { AstCallableReferenceContract } from "src/source_types";
import type { TypeScriptAstTraversalContract } from "src/typescript_runtime_protocols";
import type { TypeScriptCallExpressionInspectorContract, TypeScriptReferenceOwnershipContract } from "src/typescript_analysis_protocols";
import type { TypeScriptCallReferenceCollectorContract } from "src/model/protocols";
import type { TypeScriptCallReferenceCollectorOptions } from "src/model/types";

/** Responsibilities: _syntax traversal_, _reference ownership_. **/
export class TypeScriptCallReferenceCollector implements TypeScriptCallReferenceCollectorContract {
	private readonly source_file: ts.SourceFile;
	private readonly context: TypeScriptReferenceOwnershipContract;
	private readonly expression_inspector: TypeScriptCallExpressionInspectorContract;
	private readonly traversal: TypeScriptAstTraversalContract;

	/** Responsibilities: _node routing invocation traversal_. **/
	private visit_node(node: ts.Node, references: AstCallableReferenceContract[], owner: string = ""): void {
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
		this.append_reference(node, references, current_owner);
		ts.forEachChild(node, (child) => this.visit_node(child, references, current_owner));
	}

	/** Responsibilities: _nested node preservation traversal_. **/
	private append_nested_node(node: ts.Node, references: AstCallableReferenceContract[], owner: string = ""): void {
		if (ts.isCallExpression(node)) {
			this.append_nested_values(node, references, owner);
			this.append_call_target(node, references, owner);
			return;
		}
		if (ts.isNewExpression(node)) {
			this.append_new_node(node, references, owner);
			return;
		}
		if (ts.isArrayLiteralExpression(node)) {
			this.append_nested_values(node, references, owner);
		}
	}

	/** Responsibilities: _aggregation constructor references inspection_. **/
	private append_new_node(
		node: ts.NewExpression,
		references: AstCallableReferenceContract[],
		owner: string = "",
	): void {
		this.append_nested_values(node, references, owner);
		if (ts.isIdentifier(node.expression) || ts.isPropertyAccessExpression(node.expression)) {
			const call_reference = new TypeScriptCallReference();
			references.push(call_reference.call_reference(this.source_file, this.context, node.expression));
		}
	}

	/** Responsibilities: _nested object values traversal_. **/
	private append_nested_values(node: ts.Node, references: AstCallableReferenceContract[], owner: string = ""): void {
		if (ts.isArrayLiteralExpression(node)) {
			this.append_argument_values(node.elements, references, owner);
			return;
		}
		if (ts.isCallExpression(node) || ts.isNewExpression(node)) {
			if (node.arguments !== undefined) {
				this.append_argument_values(node.arguments, references, owner);
			}
		}
	}

	/** Responsibilities: _invocation argument expressions traversal_. **/
	private append_argument_values(
		arguments_list: readonly ts.Expression[],
		references: AstCallableReferenceContract[],
		owner: string = "",
	): void {
		for (const argument of arguments_list) {
			if (ts.isSpreadElement(argument)) {
				this.append_expression_reference(argument.expression, references, owner);
				continue;
			}
			this.append_expression_reference(argument, references, owner);
		}
	}

	/** Responsibilities: _identification supported callable reference_. **/
	private supported_reference(node: ts.Node): boolean {
		if (ts.isIdentifier(node) || ts.isPropertyAccessExpression(node)) {
			return true;
		}
		if (!ts.isElementAccessExpression(node)) {
			return false;
		}
		const argument = node.argumentExpression;
		return ts.isStringLiteral(argument) || ts.isNoSubstitutionTemplateLiteral(argument);
	}

	/** Responsibilities: _collection supported callable reference_. **/
	private append_expression_reference(
		expression: ts.Expression,
		references: AstCallableReferenceContract[],
		owner: string = "",
	): void {
		if (!this.supported_reference(expression)) {
			return;
		}
		const call_reference = new TypeScriptCallReference();
		references.push(
			call_reference.call_reference(this.source_file, this.context, expression, {
				current_owner: owner,
				is_bound: false,
				is_call: false,
			}),
		);
	}

	/** Responsibilities: _aggregation callable target invocation_. **/
	private append_call_target(
		node: ts.CallExpression,
		references: AstCallableReferenceContract[],
		owner: string = "",
	): void {
		const bound_expressions = this.expression_inspector.bind_target(node);
		if (bound_expressions.length > 0) {
			this.append_target(bound_expressions[0], references, "bound", owner);
			return;
		}
		if (this.supported_reference(node.expression)) {
			this.append_target(node.expression, references, "call", owner);
		}
	}

	/** Responsibilities: _aggregation resolution callable reference_. **/
	private append_target(
		expression: ts.Node,
		references: AstCallableReferenceContract[],
		target_kind: CallTargetKind,
		owner: string = "",
	): void {
		const options = { current_owner: owner, is_bound: false, is_call: false };
		if (target_kind === "bound") {
			options.is_bound = true;
		} else {
			options.is_call = true;
		}
		if (!this.supported_reference(expression)) {
			return;
		}
		const call_reference = new TypeScriptCallReference();
		references.push(call_reference.call_reference(this.source_file, this.context, expression, options));
	}

	/** Responsibilities: _initialization source context callable-reference_. **/
	constructor(options: TypeScriptCallReferenceCollectorOptions) {
		this.expression_inspector = new TypeScriptCallExpressionInspector();
		this.source_file = options.source_file;
		this.traversal = options.traversal;
		this.context = new TypeScriptReferenceOwnership(
			options.source_file,
			options.project_root,
			options.stage_timer,
			options.source_files,
			options.source_io,
		);
	}

	/** Responsibilities: _callable reference aggregation_. **/
	public append_reference(node: ts.Node, references: AstCallableReferenceContract[], owner: string = ""): void {
		switch (node.kind) {
			case ts.SyntaxKind.PropertyAssignment:
			case ts.SyntaxKind.VariableDeclaration:
			case ts.SyntaxKind.Parameter:
			case ts.SyntaxKind.ReturnStatement:
			case ts.SyntaxKind.BinaryExpression: {
				const expressions = this.expression_inspector.direct_value_expression(node);
				if (expressions.length > 0) {
					this.append_expression_reference(expressions[0], references, owner);
				}
				return;
			}
			case ts.SyntaxKind.CallExpression:
			case ts.SyntaxKind.NewExpression:
			case ts.SyntaxKind.ArrayLiteralExpression:
				this.append_nested_node(node, references, owner);
				return;
			default:
				return;
		}
	}

	/** Responsibilities: _collection callable references source-file_. **/
	public collect(): AstCallableReference[] {
		const references: AstCallableReferenceContract[] = [];
		this.traversal.visit((node, _, owner) => this.append_reference(node, references, owner));
		return references;
	}

	/** Responsibilities: _collection callable references AST_. **/
	public collect_node(node: ts.Node): AstCallableReference[] {
		const references: AstCallableReferenceContract[] = [];
		this.visit_node(node, references);
		return references;
	}
}
