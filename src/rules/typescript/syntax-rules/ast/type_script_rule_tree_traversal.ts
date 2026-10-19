import ts from "typescript";

import type {
	TypeScriptAstTraversalContract,
	TypeScriptNodeRulesContract,
	UndefinedCheckRulesContract,
	TypeScriptRuleTreeTraversalContract,
} from "src/protocols";
import type { RuleContextData } from "src/types";

/** Responsibilities: _TypeScript rule-tree traversal_, _constructor state propagation_. **/
export class TypeScriptRuleTreeTraversal implements TypeScriptRuleTreeTraversalContract {
	private readonly traversal: TypeScriptAstTraversalContract;
	private readonly script_node_rules: TypeScriptNodeRulesContract;
	private readonly undefined_check_rules: UndefinedCheckRulesContract;

	/** Responsibilities: _child node stack preparation_. **/
	private append_child_nodes(
		node: ts.Node,
		inside_constructor: boolean,
		pending_nodes: ts.Node[],
		pending_states: boolean[],
	): void {
		let child_inside_constructor = inside_constructor;
		if (ts.isConstructorDeclaration(node)) {
			child_inside_constructor = true;
		}
		const children: ts.Node[] = [];
		node.forEachChild((child) => {
			children.push(child);
		});
		for (let index = children.length - 1; index >= 0; index -= 1) {
			const child = children[index];
			if (child === undefined) {
				continue;
			}
			pending_nodes.push(child);
			pending_states.push(child_inside_constructor);
		}
	}

	/** Responsibilities: _TypeScript rule-tree traversal initialization_. **/
	public constructor(
		traversal: TypeScriptAstTraversalContract,
		script_node_rules: TypeScriptNodeRulesContract,
		undefined_check_rules: UndefinedCheckRulesContract,
	) {
		this.traversal = traversal;
		this.script_node_rules = script_node_rules;
		this.undefined_check_rules = undefined_check_rules;
	}

	/** Responsibilities: _root rule dispatch_. **/
	public append_root_children(context: RuleContextData): void {
		this.traversal.visit_children((node, inside_constructor) => {
			this.script_node_rules.append_node_rules(node, inside_constructor, context);
			this.undefined_check_rules.append(node);
		});
	}

	/** Responsibilities: _nested rule-tree traversal_. **/
	public append_nested_children(node: ts.Node, inside_constructor: boolean, context: RuleContextData): void {
		const pending_nodes: ts.Node[] = [];
		const pending_states: boolean[] = [];
		this.append_child_nodes(node, inside_constructor, pending_nodes, pending_states);
		while (pending_nodes.length > 0) {
			const current = pending_nodes.pop();
			const current_state = pending_states.pop();
			if (current === undefined || current_state === undefined) {
				continue;
			}
			this.script_node_rules.append_node_rules(current, current_state, context);
			this.undefined_check_rules.append(current);
			this.append_child_nodes(current, current_state, pending_nodes, pending_states);
		}
	}
}
