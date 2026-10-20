import ts from "typescript";
import type { JestBindingIndexContract } from "src/testing_protocols";
import { JestExecutionRegion } from "src/linting/orchestration/runtime/typescript-rule-groups/jest/jest_execution_region";

/** Responsibilities: _promise declaration_, _completion observation context_. **/
export class JestAsyncResultObservation {
	private readonly declaration: ts.VariableDeclaration;
	private readonly body: ts.Block;
	private readonly callback: ts.FunctionLikeDeclaration;
	private readonly bindings: JestBindingIndexContract;
	private readonly declaration_index: number;

	/** Responsibilities: _top-level callback statement index_. **/
	private statement_index(node: ts.Node, returned: boolean): number {
		let statement: ts.Node = node;
		while (statement.parent !== this.body) {
			if (statement.parent === undefined || ts.isFunctionLike(statement.parent)) {
				return -1;
			}
			statement = statement.parent;
		}
		if (!ts.isStatement(statement)) {
			return -1;
		}
		if (returned && !ts.isReturnStatement(statement)) {
			return -1;
		}
		return this.body.statements.indexOf(statement);
	}

	/** Responsibilities: _conditional statement classification_. **/
	private conditional_statement(statement: ts.Statement): boolean {
		if (ts.isIfStatement(statement)) {
			return true;
		}
		if (ts.isSwitchStatement(statement)) {
			return true;
		}
		if (ts.isIterationStatement(statement, false)) {
			return true;
		}
		return ts.isTryStatement(statement);
	}

	/** Responsibilities: _conditional expression classification_. **/
	private conditional_expression(node: ts.Node): boolean {
		if (ts.isConditionalExpression(node)) {
			return true;
		}
		if (ts.isCatchClause(node)) {
			return true;
		}
		if (!ts.isBinaryExpression(node)) {
			return false;
		}
		const operator = node.operatorToken.kind;
		if (operator === ts.SyntaxKind.AmpersandAmpersandToken) {
			return true;
		}
		if (operator === ts.SyntaxKind.BarBarToken) {
			return true;
		}
		return operator === ts.SyntaxKind.QuestionQuestionToken;
	}

	/** Responsibilities: _conditional node classification_. **/
	private conditional_node(node: ts.Node): boolean {
		if (ts.isIfStatement(node)) {
			return true;
		}
		if (ts.isSwitchStatement(node)) {
			return true;
		}
		if (ts.isIterationStatement(node, false)) {
			return true;
		}
		return this.conditional_expression(node);
	}

	/** Responsibilities: _conditional await classification_. **/
	private conditional_await(node: ts.Node, statement: ts.Statement): boolean {
		if (this.conditional_statement(statement)) {
			return true;
		}
		let current = node;
		while (current !== statement) {
			if (this.conditional_node(current)) {
				return true;
			}
			if (ts.isFunctionLike(current) && current !== this.callback) {
				return true;
			}
			if (current.parent === undefined) {
				return false;
			}
			current = current.parent;
		}
		return false;
	}

	/** Responsibilities: _callback control-flow gap detection_. **/
	private control_flow_gap(observation_index: number): boolean {
		const between = this.body.statements.slice(this.declaration_index + 1, observation_index);
		for (const statement of between) {
			if (this.conditional_statement(statement)) {
				return true;
			}
			if (ts.isReturnStatement(statement)) {
				return true;
			}
			if (ts.isThrowStatement(statement)) {
				return true;
			}
		}
		return false;
	}

	/** Responsibilities: _async result declaration reference_. **/
	private declaration_reference(node: ts.Node): boolean {
		if (!ts.isIdentifier(node) || node === this.declaration.name) {
			return false;
		}
		const expected_declaration = new Set<ts.Declaration>([this.declaration]);
		return this.bindings.binding_is(node, expected_declaration);
	}

	/** Responsibilities: _unconditional async-result observation_. **/
	private valid_observation(node: ts.Node): boolean {
		const awaited = ts.isAwaitExpression(node.parent) && node.parent.expression === node;
		const returned = ts.isReturnStatement(node.parent) && node.parent.expression === node;
		if (!awaited && !returned) {
			return false;
		}
		const observation_index = this.statement_index(node, returned);
		if (observation_index <= this.declaration_index) {
			return false;
		}
		if (this.control_flow_gap(observation_index)) {
			return false;
		}
		if (awaited && this.conditional_await(node, this.body.statements[observation_index])) {
			return false;
		}
		return true;
	}

	/** Responsibilities: _promise observation context initialization_. **/
	public constructor(
		declaration: ts.VariableDeclaration,
		body: ts.Block,
		callback: ts.FunctionLikeDeclaration,
		bindings: JestBindingIndexContract,
	) {
		this.declaration = declaration;
		this.body = body;
		this.callback = callback;
		this.bindings = bindings;
		const statement = declaration.parent.parent;
		let declaration_index = -1;
		if (ts.isVariableStatement(statement)) {
			declaration_index = body.statements.indexOf(statement);
		}
		this.declaration_index = declaration_index;
	}

	/** Responsibilities: _promise binding observation_. **/
	public observes(node: ts.Node): boolean {
		if (!this.declaration_reference(node)) {
			return false;
		}
		return this.valid_observation(node);
	}

	/** Responsibilities: _promise completion analysis_. **/
	public completed(): boolean {
		if (this.declaration_index < 0) {
			return false;
		}
		let result = false;
		const region = new JestExecutionRegion(this.body, (node) => {
			if (this.observes(node)) {
				result = true;
			}
		});
		region.visit();
		return result;
	}
}
