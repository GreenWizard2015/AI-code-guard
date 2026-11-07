import type { Assignment, AssignmentDetails } from "src/model_types";
import { TypeScriptPointlessAssignmentCandidates } from "src/rules/typescript/syntax-rules/ast/verifier/callable-analysis/type_script_pointless_assignment_candidates";
import type { TypeScriptAssignmentAnalysisContract } from "src/typescript_runtime_protocols";
import ts from "typescript";

/** Responsibilities: _assignment chain extraction_, _pointless assignment analysis_. **/
export class TypeScriptAssignmentAnalysis implements TypeScriptAssignmentAnalysisContract {
	private readonly _function_initializer_kinds: ReadonlySet<ts.SyntaxKind>;
	private readonly single_argument = 1;

	/** Responsibilities: _first destructured binding name_. **/
	private first_binding_name(name: ts.BindingPattern): string {
		const first = name.elements[0];
		if (!first || !ts.isBindingElement(first)) {
			return "";
		}
		return this.binding_name(first.name);
	}

	/** Responsibilities: _constructor argument name extraction_. **/
	private constructor_argument_names(expression: ts.NewExpression): string[] {
		if (!expression.arguments || expression.arguments.length !== this.single_argument) {
			return [];
		}
		const argument = expression.arguments[0];
		if (argument === undefined || !ts.isIdentifier(argument)) {
			return [];
		}
		return [argument.text];
	}

	/** Responsibilities: _object shorthand name extraction_. **/
	private object_shorthand_names(expression: ts.Expression): string[] {
		if (!ts.isObjectLiteralExpression(expression) || expression.properties.length !== this.single_argument) {
			return [];
		}
		const property = expression.properties[0];
		if (property === undefined || !ts.isShorthandPropertyAssignment(property)) {
			return [];
		}
		return [property.name.text];
	}

	/** Responsibilities: _creation normalization assignment metadata_. **/
	private create_assignment(
		declaration: ts.VariableDeclaration,
		statement: ts.VariableStatement,
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
		const name = this.binding_name(declaration.name);
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
	private assignment_declaration(statement: ts.VariableStatement): ts.VariableDeclaration[] {
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

	/** Responsibilities: _collection normalization assignments statement_. **/
	/** Responsibilities: _assignment analysis composition_. **/
	public constructor(function_initializer_kinds: ReadonlySet<ts.SyntaxKind>) {
		this._function_initializer_kinds = function_initializer_kinds;
	}

	/** Responsibilities: _binding name resolution_. **/
	public binding_name(name: ts.BindingName): string {
		if (ts.isIdentifier(name)) {
			return name.text;
		}
		return this.first_binding_name(name);
	}

	/** Responsibilities: _return expression name extraction_. **/
	public returned_names_from(statement: ts.Statement): string[] {
		if (!ts.isReturnStatement(statement) || !statement.expression) {
			return [];
		}
		const expression = statement.expression;
		if (ts.isNewExpression(expression)) {
			return this.constructor_argument_names(expression);
		}
		if (ts.isIdentifier(expression)) {
			return [expression.text];
		}
		return this.object_shorthand_names(expression);
	}

	/** Responsibilities: _assignment value collection_. **/
	public assignment_value(statement: ts.Statement, source_file: ts.SourceFile): Assignment[] {
		if (!ts.isVariableStatement(statement)) {
			return [];
		}
		for (const declaration of this.assignment_declaration(statement)) {
			return this.create_assignment(declaration, statement, source_file);
		}
		return [];
	}

	/** Responsibilities: _reporting assignments introduce pointless_. **/
	public pointless_assignment(candidates: Assignment[], returned_name: string): boolean {
		const candidate_state = new TypeScriptPointlessAssignmentCandidates(
			candidates,
			returned_name,
			this._function_initializer_kinds,
		);
		if (candidate_state.pointless_single_assignment()) {
			return true;
		}
		return candidate_state.pointless_assignment_chain();
	}
}
