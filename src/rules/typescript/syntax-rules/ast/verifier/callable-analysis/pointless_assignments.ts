import type { ASTSourceRuleContract } from "src/ast_verifier_protocols";
import { TYPE_SCRIPT_CALLABLE_BODY_KINDS } from "src/constants";
import { RULE_IDS } from "src/linting/constants";
import { TypeScriptCallableBody } from "src/parser/typescript-aliases/callables/type_script_callable_body";
import type { Assignment } from "src/types";
import type { RuleContextContract } from "src/types";
import type { TypeScriptNodeVerificationRequest } from "src/typescript_analysis_types";
import type { TypeScriptAssignmentAnalysisContract } from "src/typescript_runtime_protocols";
import ts from "typescript";

/** Responsibilities: _pointless assignment detection_, _callable node verification_. **/
export class PointlessAssignments implements ASTSourceRuleContract {
	private readonly _assignment_analysis: TypeScriptAssignmentAnalysisContract;
	private readonly _callable_body: TypeScriptCallableBody;

	/** Responsibilities: _assignment source node resolution_. **/
	private assignment_node(candidate: Assignment): ts.Node {
		let node: ts.Node = candidate.initializer;
		while (node.parent !== undefined && !ts.isVariableStatement(node.parent)) {
			node = node.parent;
		}
		const parent = node.parent;
		if (parent !== undefined && ts.isVariableStatement(parent)) {
			return parent;
		}
		return node;
	}

	/** Responsibilities: _return-linked assignment reporting_. **/
	private append_returned_assignment(
		statement: ts.ReturnStatement,
		candidates: Assignment[],
		context: RuleContextContract,
	): void {
		const returned_names = this._assignment_analysis.returned_names_from(statement);
		for (const returned_name of returned_names) {
			if (candidates.length === 0) {
				continue;
			}
			if (!this._assignment_analysis.pointless_assignment(candidates, returned_name)) {
				continue;
			}
			const first_candidate = candidates.at(0);
			if (first_candidate === undefined) {
				continue;
			}
			context.for_node(this.assignment_node(first_candidate)).append_rule(RULE_IDS.pointless_assignment);
		}
	}

	/** Responsibilities: _callable body assignment scan_. **/
	private scan_callable_assignments(body: ts.Block, context: RuleContextContract): void {
		let candidates: Assignment[] = [];
		for (const statement of body.statements) {
			const assignments = this._assignment_analysis.assignment_value(statement, context.state().source.source_file);
			if (assignments.length > 0) {
				const assignment = assignments.at(0);
				if (assignment !== undefined) {
					candidates.push(assignment);
				}
				continue;
			}
			if (ts.isReturnStatement(statement)) {
				this.append_returned_assignment(statement, candidates, context);
			}
			candidates = [];
		}
	}

	/** Responsibilities: _pointless assignment verifier initialization_. **/
	public constructor(assignment_analysis: TypeScriptAssignmentAnalysisContract) {
		this._assignment_analysis = assignment_analysis;
		this._callable_body = new TypeScriptCallableBody(TYPE_SCRIPT_CALLABLE_BODY_KINDS);
	}

	/** Responsibilities: _pointless assignment source activation_. **/
	public active_for(source_code: string): boolean {
		return source_code.length > 0;
	}

	/** Responsibilities: _pointless assignment AST dispatch_. **/
	public verify(request: TypeScriptNodeVerificationRequest): void {
		this._callable_body.resolve(request.node, false, (body) => {
			if (!ts.isBlock(body)) {
				return false;
			}
			this.scan_callable_assignments(body, request.context);
			return true;
		});
	}
}
