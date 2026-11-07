import { TypeScriptAstDispatchPhase } from "src/parser/analysis/protocols";
import { TypeScriptAstNodeObserverRegistry } from "src/parser/analysis/type_script_ast_node_observer_registry";
import { TypeScriptCallExpressionInspector } from "src/parser/analysis/type_script_call_expression_inspector";
import ts from "typescript";

import { METRIC_KIND_FUNCTION, METRIC_KIND_METHOD } from "src/metrics/constants";
import type { AstCallableReference } from "src/model/ast/normalized_ast_types";
import type { TypeScriptCallReferenceCollectorContract } from "src/model/protocols";
import { TypeScriptReferenceResolution } from "src/model/type_script_reference_resolution";
import { TypeScriptReferenceQueryKind } from "src/model/types";
import type { TypeScriptCallReferenceCollectorOptions } from "src/model/types";
import { TypeScriptReferenceOwnership } from "src/parser/references/identity/references/type_script_reference_ownership";
import type { CallReferenceOptions } from "src/parser/types";
import type { AstCallableReferenceRecord } from "src/source_types";
import type {
	TypeScriptCallExpressionInspectorContract,
	TypeScriptReferenceOwnershipContract,
} from "src/typescript_analysis_protocols";
import type { TypeScriptAstTraversalContract } from "src/typescript_runtime_protocols";

/** Responsibilities: _syntax traversal_, _reference ownership_. **/
export class TypeScriptCallReferenceCollector implements TypeScriptCallReferenceCollectorContract {
	private readonly _source_file: ts.SourceFile;
	private readonly _context: TypeScriptReferenceOwnershipContract;
	private readonly _expression_inspector: TypeScriptCallExpressionInspectorContract;
	private readonly _traversal: TypeScriptAstTraversalContract;
	private readonly _collected_references: AstCallableReferenceRecord[];
	private readonly _node_dispatcher: TypeScriptAstNodeObserverRegistry<void>;

	/** Responsibilities: _method reference construction_. **/
	private method_reference(expression: ts.AccessExpression, line: number, caller_owner: string): AstCallableReference {
		const resolution = this._context.resolve_reference({
			kind: TypeScriptReferenceQueryKind.MethodReference,
			expression,
			owner: caller_owner,
		});
		return resolution.callable_reference(METRIC_KIND_METHOD, line);
	}

	/** Responsibilities: _callable reference normalization_. **/
	private call_reference(expression: ts.Expression, options: CallReferenceOptions): AstCallableReference {
		const line = this._source_file.getLineAndCharacterOfPosition(expression.getStart(this._source_file)).line;
		if (ts.isIdentifier(expression)) {
			const identity = this._context.function_reference(expression);
			const resolution = new TypeScriptReferenceResolution("", identity.name, identity.target_file);
			return resolution.callable_reference(METRIC_KIND_FUNCTION, line);
		}
		if (ts.isPropertyAccessExpression(expression) || ts.isElementAccessExpression(expression)) {
			return this.method_reference(expression, line, options.current_owner);
		}
		throw new Error("Unsupported TypeScript call reference expression.");
	}

	/** Responsibilities: _node routing invocation traversal_. **/
	/** Responsibilities: _nested node preservation traversal_. **/
	private append_nested_node(nested_expression: ts.Node, container_owner = ""): void {
		if (ts.isCallExpression(nested_expression)) {
			this.append_nested_values(nested_expression, container_owner);
			this.append_call_target(nested_expression, container_owner);
			return;
		}
		if (ts.isNewExpression(nested_expression)) {
			this.append_new_node(nested_expression, container_owner);
			return;
		}
		if (ts.isArrayLiteralExpression(nested_expression)) {
			this.append_nested_values(nested_expression, container_owner);
		}
	}

	/** Responsibilities: _aggregation constructor references inspection_. **/
	private append_new_node(construction: ts.NewExpression, construction_owner = ""): void {
		this.append_nested_values(construction, construction_owner);
		if (ts.isIdentifier(construction.expression) || ts.isPropertyAccessExpression(construction.expression)) {
			this.append_expression_reference(construction.expression, {
				current_owner: construction_owner,
				is_bound: false,
				is_call: false,
			});
		}
	}

	/** Responsibilities: _nested object values traversal_. **/
	private append_nested_values(container: ts.Node, nested_owner = ""): void {
		if (ts.isArrayLiteralExpression(container)) {
			this.append_argument_values(container.elements, nested_owner);
			return;
		}
		if ((ts.isCallExpression(container) || ts.isNewExpression(container)) && container.arguments !== undefined) {
			this.append_argument_values(container.arguments, nested_owner);
		}
	}

	/** Responsibilities: _invocation argument expressions traversal_. **/
	private append_argument_values(arguments_list: readonly ts.Expression[], argument_owner = ""): void {
		for (const argument of arguments_list) {
			if (ts.isSpreadElement(argument)) {
				this.append_expression_reference(argument.expression, {
					current_owner: argument_owner,
					is_bound: false,
					is_call: false,
				});
				continue;
			}
			this.append_expression_reference(argument, {
				current_owner: argument_owner,
				is_bound: false,
				is_call: false,
			});
		}
	}

	/** Responsibilities: _identification supported callable reference_. **/
	private supported_reference(reference_expression: ts.Node): boolean {
		if (ts.isIdentifier(reference_expression) || ts.isPropertyAccessExpression(reference_expression)) {
			return true;
		}
		if (!ts.isElementAccessExpression(reference_expression)) {
			return false;
		}
		const argument = reference_expression.argumentExpression;
		return ts.isStringLiteral(argument) || ts.isNoSubstitutionTemplateLiteral(argument);
	}

	/** Responsibilities: _method reference collection_. **/
	private append_method_reference(reference: AstCallableReference, context: CallReferenceOptions): void {
		let caller_owner = context.current_owner;
		if (caller_owner.length === 0) {
			caller_owner = reference.caller_owner;
		}
		let is_call = context.is_call;
		if (!is_call) {
			is_call = reference.is_call;
		}
		this._collected_references.push({ ...reference, caller_owner, is_call });
	}

	/** Responsibilities: _collection supported callable reference_. **/
	private append_expression_reference(expression: ts.Expression, options: CallReferenceOptions): void {
		if (!this.supported_reference(expression)) {
			return;
		}
		const reference = this.call_reference(expression, options);
		if (ts.isIdentifier(expression) || options.is_bound) {
			this._collected_references.push(reference);
			return;
		}
		this.append_method_reference(reference, options);
	}

	/** Responsibilities: _aggregation callable target invocation_. **/
	private append_call_target(invocation: ts.CallExpression, invocation_owner = ""): void {
		for (const bound_expression of this._expression_inspector.bind_target(invocation)) {
			this.append_expression_reference(bound_expression, {
				current_owner: invocation_owner,
				is_bound: true,
				is_call: false,
			});
			return;
		}
		if (this.supported_reference(invocation.expression)) {
			this.append_expression_reference(invocation.expression, {
				current_owner: invocation_owner,
				is_bound: false,
				is_call: true,
			});
		}
	}

	/** Responsibilities: _direct callable expression reference_. **/
	private append_direct_reference(expressions: readonly ts.Expression[], direct_owner: string): void {
		for (const expression of expressions) {
			this.append_expression_reference(expression, {
				current_owner: direct_owner,
				is_bound: false,
				is_call: false,
			});
			return;
		}
	}

	/** Responsibilities: _initialization source context callable-reference_. **/
	public constructor(options: TypeScriptCallReferenceCollectorOptions) {
		this._expression_inspector = new TypeScriptCallExpressionInspector(options.declaration_index);
		this._collected_references = [];
		this._source_file = options.source_file;
		this._traversal = options.traversal;
		this._node_dispatcher = new TypeScriptAstNodeObserverRegistry();
		const reference_node_kinds: ts.SyntaxKind[] = [
			ts.SyntaxKind.PropertyAssignment,
			ts.SyntaxKind.VariableDeclaration,
			ts.SyntaxKind.Parameter,
			ts.SyntaxKind.ReturnStatement,
			ts.SyntaxKind.BinaryExpression,
			ts.SyntaxKind.CallExpression,
			ts.SyntaxKind.NewExpression,
			ts.SyntaxKind.ArrayLiteralExpression,
		];
		this._node_dispatcher.register(TypeScriptAstDispatchPhase.ReferenceState, reference_node_kinds, ({ node, owner }) =>
			this.append_reference(node, owner),
		);
		this._context = new TypeScriptReferenceOwnership({
			source_file: options.source_file,
			traversal: options.traversal,
			project_root: options.project_root,
			stage_timer: options.stage_timer,
			source_files: options.source_files,
			source_io: options.source_io,
		});
	}

	/** Responsibilities: _callable reference aggregation_. **/
	public append_reference(visited_node: ts.Node, traversal_owner = ""): void {
		switch (visited_node.kind) {
			case ts.SyntaxKind.PropertyAssignment:
			case ts.SyntaxKind.VariableDeclaration:
			case ts.SyntaxKind.Parameter:
			case ts.SyntaxKind.ReturnStatement:
			case ts.SyntaxKind.BinaryExpression: {
				const expressions = this._expression_inspector.direct_value_expression(visited_node);
				this.append_direct_reference(expressions, traversal_owner);
				return;
			}
			case ts.SyntaxKind.CallExpression:
			case ts.SyntaxKind.NewExpression:
			case ts.SyntaxKind.ArrayLiteralExpression: {
				this.append_nested_node(visited_node, traversal_owner);
				return;
			}
			default:
				return;
		}
	}

	/** Responsibilities: _callable reference snapshot_. **/
	public collect(): AstCallableReference[] {
		this._collected_references.length = 0;
		this._node_dispatcher.dispatch(
			TypeScriptAstDispatchPhase.ReferenceState,
			this._traversal,
			this._source_file,
			undefined,
		);
		return [...this._collected_references];
	}

	/** Responsibilities: _callable reference snapshot_. **/
	public references(): AstCallableReference[] {
		return [...this._collected_references];
	}
}
