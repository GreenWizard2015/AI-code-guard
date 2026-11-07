import type {
	TypeScriptConditionalParentIndexContract,
	TypeScriptExpressionContainersContract,
} from "src/typescript_analysis_protocols";
import ts from "typescript";

/** Responsibilities: _conditional parent lookup_, _conditional statement classification_. **/
export class TypeScriptConditionalParentIndex implements TypeScriptConditionalParentIndexContract {
	private readonly _expression_containers: TypeScriptExpressionContainersContract;
	private readonly _parent_results: WeakMap<ts.BinaryExpression, boolean>;

	/** Responsibilities: _conditional parent traversal_. **/
	private find_parent(search_node: ts.Node, path: ts.BinaryExpression[]): boolean {
		const container = search_node.parent;
		if (container === undefined) {
			return false;
		}
		if (ts.isBinaryExpression(search_node)) {
			path.push(search_node);
		}
		if (!this._expression_containers.contains(container, search_node)) {
			return this.statement_condition_parent(container, search_node);
		}
		if (ts.isBinaryExpression(container)) {
			const cached = this._parent_results.get(container);
			if (cached !== undefined) {
				return cached;
			}
		}
		return this.find_parent(container, path);
	}

	/** Responsibilities: _expression statement condition_. **/
	private expression_statement_parent(candidate_container: ts.Node, nested_expression: ts.Node): boolean {
		if (ts.isExpressionStatement(candidate_container)) {
			return candidate_container.expression === nested_expression;
		}
		if (ts.isIfStatement(candidate_container)) {
			return candidate_container.expression === nested_expression;
		}
		if (ts.isWhileStatement(candidate_container)) {
			return candidate_container.expression === nested_expression;
		}
		if (ts.isDoStatement(candidate_container)) {
			return candidate_container.expression === nested_expression;
		}
		return false;
	}

	/** Responsibilities: _conditional parent index initialization_. **/
	public constructor(expression_containers: TypeScriptExpressionContainersContract) {
		this._expression_containers = expression_containers;
		this._parent_results = new WeakMap<ts.BinaryExpression, boolean>();
	}

	/** Responsibilities: _conditional parent classification_. **/
	public conditional_parent(binary_expression: ts.BinaryExpression): boolean {
		const cached = this._parent_results.get(binary_expression);
		if (cached !== undefined) {
			return cached;
		}
		const path: ts.BinaryExpression[] = [];
		const result = this.find_parent(binary_expression, path);
		for (const expression of path) {
			this._parent_results.set(expression, result);
		}
		return result;
	}

	/** Responsibilities: _statement condition parent classification_. **/
	public statement_condition_parent(statement_node: ts.Node, condition_node: ts.Node): boolean {
		if (this.expression_statement_parent(statement_node, condition_node)) {
			return true;
		}
		if (ts.isForStatement(statement_node)) {
			return statement_node.condition === condition_node;
		}
		if (ts.isReturnStatement(statement_node)) {
			return statement_node.expression === condition_node;
		}
		if (ts.isSwitchStatement(statement_node)) {
			return statement_node.expression === condition_node;
		}
		if (ts.isConditionalExpression(statement_node)) {
			return statement_node.condition === condition_node;
		}
		return false;
	}
}
