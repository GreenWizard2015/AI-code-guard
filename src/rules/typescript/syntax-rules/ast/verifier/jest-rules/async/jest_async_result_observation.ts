import { JestExecutionRegion } from "src/jest_execution_region";
import type { JestBindingIndexContract } from "src/testing_protocols";
import ts from "typescript";

/** Responsibilities: _promise declaration_, _completion observation context_. **/
export class JestAsyncResultObservation {
	private readonly _declaration: ts.VariableDeclaration;
	private readonly _body: ts.Block;
	private readonly _callback: ts.FunctionLikeDeclaration;
	private readonly _bindings: JestBindingIndexContract;
	private readonly _declaration_index: number;

	/** Responsibilities: _top-level callback statement index_. **/
	private statement_index(observation: ts.Node, returned: boolean): number {
		let statement: ts.Node = observation;
		while (statement.parent !== this._body) {
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
		return this._body.statements.indexOf(statement);
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
	private conditional_expression(candidate: ts.Node): boolean {
		if (ts.isConditionalExpression(candidate)) {
			return true;
		}
		if (ts.isCatchClause(candidate)) {
			return true;
		}
		if (!ts.isBinaryExpression(candidate)) {
			return false;
		}
		const operator = candidate.operatorToken.kind;
		if (operator === ts.SyntaxKind.AmpersandAmpersandToken) {
			return true;
		}
		if (operator === ts.SyntaxKind.BarBarToken) {
			return true;
		}
		return operator === ts.SyntaxKind.QuestionQuestionToken;
	}

	/** Responsibilities: _conditional node classification_. **/
	private conditional_node(candidate: ts.Node): boolean {
		if (ts.isIfStatement(candidate)) {
			return true;
		}
		if (ts.isSwitchStatement(candidate)) {
			return true;
		}
		if (ts.isIterationStatement(candidate, false)) {
			return true;
		}
		return this.conditional_expression(candidate);
	}

	/** Responsibilities: _conditional await classification_. **/
	private conditional_await(await_expression: ts.Node, containing_statement: ts.Statement): boolean {
		if (this.conditional_statement(containing_statement)) {
			return true;
		}
		let current = await_expression;
		while (current !== containing_statement) {
			if (this.conditional_node(current)) {
				return true;
			}
			if (ts.isFunctionLike(current) && current !== this._callback) {
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
		const between = this._body.statements.slice(this._declaration_index + 1, observation_index);
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
	private declaration_reference(reference_candidate: ts.Node): boolean {
		if (!ts.isIdentifier(reference_candidate) || reference_candidate === this._declaration.name) {
			return false;
		}
		const expected_declaration = new Set<ts.Declaration>([this._declaration]);
		return this._bindings.binding_is(reference_candidate, expected_declaration);
	}

	/** Responsibilities: _unconditional async-result observation_. **/
	private valid_observation(observation: ts.Node): boolean {
		const awaited = ts.isAwaitExpression(observation.parent) && observation.parent.expression === observation;
		const returned = ts.isReturnStatement(observation.parent) && observation.parent.expression === observation;
		if (!awaited && !returned) {
			return false;
		}
		const observation_index = this.statement_index(observation, returned);
		if (observation_index <= this._declaration_index || this.control_flow_gap(observation_index)) {
			return false;
		}
		const statement = this._body.statements[observation_index];
		if (statement === undefined) {
			return false;
		}
		return !awaited || !this.conditional_await(observation, statement);
	}

	/** Responsibilities: _promise observation context initialization_. **/
	public constructor(
		declaration: ts.VariableDeclaration,
		body: ts.Block,
		callback: ts.FunctionLikeDeclaration,
		bindings: JestBindingIndexContract,
	) {
		this._declaration = declaration;
		this._body = body;
		this._callback = callback;
		this._bindings = bindings;
		const statement = declaration.parent.parent;
		let declaration_index = -1;
		if (ts.isVariableStatement(statement)) {
			declaration_index = body.statements.indexOf(statement);
		}
		this._declaration_index = declaration_index;
	}

	/** Responsibilities: _promise binding observation_. **/
	public observes(reference_candidate: ts.Node): boolean {
		if (!this.declaration_reference(reference_candidate)) {
			return false;
		}
		return this.valid_observation(reference_candidate);
	}

	/** Responsibilities: _promise completion analysis_. **/
	public completed(): boolean {
		if (this._declaration_index < 0) {
			return false;
		}
		let result = false;
		const region = new JestExecutionRegion(this._body, (node) => {
			if (this.observes(node)) {
				result = true;
			}
		});
		region.visit();
		return result;
	}
}
