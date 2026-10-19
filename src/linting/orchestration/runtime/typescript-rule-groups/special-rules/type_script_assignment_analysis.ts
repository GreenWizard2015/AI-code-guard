import type { Assignment, AssignmentDetails } from "src/model/types/types";
import type { PointlessExpressionContract, TypeScriptAssignmentAnalysisContract } from "src/protocols";
import ts from "typescript";

/** Responsibilities: _assignment chain extraction_, _pointless assignment analysis_. **/
export class TypeScriptAssignmentAnalysis implements TypeScriptAssignmentAnalysisContract {
	private readonly pointless_expression: PointlessExpressionContract;
	private readonly function_initializer_kinds: Set<ts.SyntaxKind>;

	/** Responsibilities: _creation normalization assignment metadata_. **/
	private create_assignment(
		declaration: ts.VariableDeclaration,
		statement: ts.Statement,
		source_file: ts.SourceFile,
	): Assignment[] {
		const details_list = this.assignment_details(declaration);
		for (const details of details_list) {
			return [
				{
					line: source_file.getLineAndCharacterOfPosition(statement.getStart(source_file)).line,
					...details,
				},
			];
		}
		return [];
	}

	/** Responsibilities: _extraction assignment details variable_. **/
	private assignment_details(declaration: ts.VariableDeclaration): AssignmentDetails[] {
		const name = this.pointless_expression.binding_name(declaration.name);
		if (!name) {
			return [];
		}
		if (declaration.initializer === undefined) {
			return [];
		}
		return [
			{
				name,
				initializer: declaration.initializer,
				simple_alias: ts.isIdentifier(declaration.initializer),
				destructured: !ts.isIdentifier(declaration.name),
			},
		];
	}

	/** Responsibilities: _extraction variable declarations assignment_. **/
	private assignment_declaration(statement: ts.Statement): ts.VariableDeclaration[] {
		if (!ts.isVariableStatement(statement)) {
			return [];
		}
		if (statement.declarationList.declarations.length !== 1) {
			return [];
		}
		for (const declaration of statement.declarationList.declarations) {
			if (declaration.initializer) {
				return [declaration];
			}
		}
		return [];
	}

	/** Responsibilities: _classification final assignment not_. **/
	private reject_last_assignment(last: Assignment, returned_name: string): boolean {
		if (last.name !== returned_name) {
			return true;
		}
		if (last.destructured) {
			return true;
		}
		return this.function_initializer_kinds.has(last.initializer.kind);
	}

	/** Responsibilities: _classification assignment name reused_. **/
	private has_reused_assignments(candidates: Assignment[], last: Assignment): boolean {
		if (candidates.slice(1).every((candidate) => candidate.simple_alias)) {
			return true;
		}
		const names = this.identifier_names(last.initializer);
		return candidates.slice(0, -1).every((candidate) => names.has(candidate.name));
	}

	/** Responsibilities: _classification node contains logical_. **/
	private is_logical_expression(node: ts.Node): boolean {
		if (!ts.isBinaryExpression(node)) {
			return false;
		}
		if (node.operatorToken.kind === ts.SyntaxKind.AmpersandAmpersandToken) {
			return true;
		}
		if (node.operatorToken.kind === ts.SyntaxKind.BarBarToken) {
			return true;
		}
		return node.operatorToken.kind === ts.SyntaxKind.QuestionQuestionToken;
	}

	/** Responsibilities: _collection initializer identifier names_. **/
	private identifier_names(node: ts.Node): Set<string> {
		const names = new Set<string>();
		const visit = (child: ts.Node): void => {
			if (ts.isIdentifier(child)) {
				names.add(child.text);
			}
			ts.forEachChild(child, visit);
		};
		visit(node);
		return names;
	}

	/** Responsibilities: _collection normalization assignments statement_. **/
	/** Responsibilities: _assignment analysis composition_. **/
	public constructor(pointless_expression: PointlessExpressionContract) {
		this.function_initializer_kinds = new Set([ts.SyntaxKind.ArrowFunction, ts.SyntaxKind.FunctionExpression]);
		this.pointless_expression = pointless_expression;
	}

	/** Responsibilities: _assignment value collection_. **/
	public assignment_value(statement: ts.Statement, source_file: ts.SourceFile): Assignment[] {
		for (const declaration of this.assignment_declaration(statement)) {
			return this.create_assignment(declaration, statement, source_file);
		}
		return [];
	}

	/** Responsibilities: _reporting assignments introduce pointless_. **/
	public pointless_assignment(candidates: Assignment[], returned_name: string): boolean {
		if (candidates.length === 0) {
			return false;
		}
		if (candidates.length === 1) {
			const candidate = candidates[0];
			if (candidate.name !== returned_name) {
				return false;
			}
			return !this.is_logical_expression(candidate.initializer);
		}
		const last = candidates[candidates.length - 1];
		if (this.reject_last_assignment(last, returned_name)) {
			return false;
		}
		return this.has_reused_assignments(candidates, last);
	}
}
