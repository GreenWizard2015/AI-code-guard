import { PointlessExpression } from 'src/rules/typescript/pointless-expression';
import ts from 'typescript';
import type { Assignment, AssignmentDetails } from 'src/bridge/ts/runner/orchestration/runtime/types';

/** Responsibilities: _normalization assignments identification logical_. **/
export class TypeScriptAssignmentAnalysis {
	private readonly pointless_expression = new PointlessExpression();
	private readonly function_initializer_kinds = new Set([
		ts.SyntaxKind.ArrowFunction,
		ts.SyntaxKind.FunctionExpression,
	]);

	/** Responsibilities: _creation normalization assignment metadata_. **/
	private create_assignment(
		declaration: ts.VariableDeclaration,
		statement: ts.Statement,
		source_file: ts.SourceFile
	): Assignment[] {
		const details_list = this.assignment_details(declaration);
		if (details_list.length === 0) {
			return [];
		}
		const details = details_list[0];
		return [{
			line: source_file.getLineAndCharacterOfPosition(statement.getStart(source_file)).line,
			...details,
		}];
	}

	/** Responsibilities: _extraction assignment details variable_. **/
	private assignment_details(declaration: ts.VariableDeclaration): AssignmentDetails[] {
		const name = this.pointless_expression.binding_name(declaration.name);
		if (!name || declaration.initializer === undefined) {
			return [];
		}
		return [{
			name,
			initializer: declaration.initializer,
			simple_alias: ts.isIdentifier(declaration.initializer),
			destructured: !ts.isIdentifier(declaration.name),
		}];
	}

	/** Responsibilities: _extraction variable declarations assignment_. **/
	private assignment_declaration(statement: ts.Statement): ts.VariableDeclaration[] {
if (!ts.isVariableStatement(statement) || statement.declarationList.declarations.length !== 1) {
			return [];
		}
		const declaration = statement.declarationList.declarations[0];
		if (!declaration.initializer) {
			return [];
		}
		return [declaration];
	}

	/** Responsibilities: _classification final assignment not_. **/
	private reject_last_assignment(last: Assignment, returned_name: string): boolean {
		if (last.name !== returned_name || last.destructured) {
			return true;
		}
		return this.function_initializer_kinds.has(last.initializer.kind);
	}

	/** Responsibilities: _classification assignment name reused_. **/
	private has_reused_assignments(candidates: Assignment[], last: Assignment): boolean {
		if (candidates.slice(1).every(candidate => candidate.simple_alias)) {
			return true;
		}
		return candidates
			.slice(0, -1)
			.every(candidate => this.contains_identifier(last.initializer, candidate.name));
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

	/** Responsibilities: _classification node references named_. **/
	private contains_identifier(node: ts.Node, name: string): boolean {
		let found = false;
		const visit = (child: ts.Node): void => {
			if (ts.isIdentifier(child) && child.text === name) {
				found = true;
			}
			if (!found) {
				ts.forEachChild(child, visit);
			}
		};
		visit(node);
		return found;
	}

	/** Responsibilities: _collection normalization assignments statement_. **/
	public assignment_value(statement: ts.Statement, source_file: ts.SourceFile): Assignment[] {
		const declarations = this.assignment_declaration(statement);
		if (declarations.length === 0) {
			return [];
		}
		const declaration = declarations[0];
		return this.create_assignment(declaration, statement, source_file);
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
