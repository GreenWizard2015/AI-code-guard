import { UNDEFINED_TYPE_NAME } from "src/metrics/constants";
import type { TypeScriptNumericExpressionEvaluatorContract } from "src/rules/typescript/syntax-rules/types";
import type { CallableStatementPredicate } from "src/runtime_types";
import ts from "typescript";

/** Responsibilities: _zero-index expression evaluation_, _undefined guard analysis_. **/
export class TypeScriptZeroIndexGuard {
	private readonly _strict_undefined_operators: Set<ts.SyntaxKind>;
	private readonly _guarded_names: WeakMap<ts.Expression, string>;
	private readonly _zero_index_names: WeakMap<ts.Statement, readonly string[]>;
	private readonly _numeric_evaluator: TypeScriptNumericExpressionEvaluatorContract;

	/** Responsibilities: _statement sibling lookup_. **/
	private statements(statement_node: ts.Statement): readonly ts.Statement[] {
		const parent = statement_node.parent;
		if (ts.isSourceFile(parent) || ts.isBlock(parent) || ts.isModuleBlock(parent)) {
			return parent.statements;
		}
		if (ts.isCaseClause(parent) || ts.isDefaultClause(parent)) {
			return parent.statements;
		}
		return [];
	}

	/** Responsibilities: _preceding statement match_. **/
	private previous_statement(current_statement: ts.Statement, matches: CallableStatementPredicate): boolean {
		const siblings = this.statements(current_statement);
		const position = siblings.indexOf(current_statement);
		if (position <= 0) {
			return false;
		}
		const previous = siblings[position - 1];
		if (previous === undefined) {
			return false;
		}
		return matches(previous);
	}

	/** Responsibilities: _zero-index variable assignment_. **/
	private zero_index_name(declaration: ts.VariableDeclaration): string {
		if (!ts.isIdentifier(declaration.name) || declaration.initializer === undefined) {
			return "";
		}
		const expression = this._numeric_evaluator.unwrap(declaration.initializer);
		if (!ts.isElementAccessExpression(expression)) {
			return "";
		}
		const index = expression.argumentExpression;
		if (index === undefined || this._numeric_evaluator.value(index) !== 0) {
			return "";
		}
		return declaration.name.text;
	}

	/** Responsibilities: _zero-index declarations in statement_. **/
	private zero_index_names(candidate_statement: ts.Statement): readonly string[] {
		if (!ts.isVariableStatement(candidate_statement)) {
			return [];
		}
		return candidate_statement.declarationList.declarations
			.map((declaration) => this.zero_index_name(declaration))
			.filter((name) => name.length > 0);
	}

	/** Responsibilities: _zero-index assignment lookup_. **/
	private assigns_zero_index(candidate_statement: ts.Statement, target_name: string): boolean {
		let names = this._zero_index_names.get(candidate_statement);
		if (names === undefined) {
			names = this.zero_index_names(candidate_statement);
			this._zero_index_names.set(candidate_statement, names);
		}
		return names.includes(target_name);
	}

	/** Responsibilities: _identifier compared with undefined_. **/
	private undefined_guard_identifier(
		identifier_expression: ts.Expression,
		undefined_expression: ts.Expression,
	): string {
		if (!ts.isIdentifier(identifier_expression)) {
			return "";
		}
		if (undefined_expression.getText() !== UNDEFINED_TYPE_NAME) {
			return "";
		}
		return identifier_expression.text;
	}

	/** Responsibilities: _strict undefined comparison name_. **/
	private strict_guard_name(comparison: ts.BinaryExpression): string {
		if (!this._strict_undefined_operators.has(comparison.operatorToken.kind)) {
			return "";
		}
		const left_name = this.undefined_guard_identifier(comparison.left, comparison.right);
		if (left_name.length > 0) {
			return left_name;
		}
		return this.undefined_guard_identifier(comparison.right, comparison.left);
	}

	/** Responsibilities: _guard expression name resolution_. **/
	private guarded_identifier(expression: ts.Expression): string {
		if (!ts.isBinaryExpression(expression)) {
			return "";
		}
		return this.strict_guard_name(expression);
	}

	/** Responsibilities: _zero-index guard initialization_. **/
	public constructor(numeric_evaluator: TypeScriptNumericExpressionEvaluatorContract) {
		this._strict_undefined_operators = new Set([
			ts.SyntaxKind.ExclamationEqualsEqualsToken,
			ts.SyntaxKind.EqualsEqualsEqualsToken,
		]);
		this._guarded_names = new WeakMap<ts.Expression, string>();
		this._zero_index_names = new WeakMap<ts.Statement, readonly string[]>();
		this._numeric_evaluator = numeric_evaluator;
	}

	/** Responsibilities: _strict undefined guard name_. **/
	public guarded_name(guard_expression: ts.Expression): string {
		const cached = this._guarded_names.get(guard_expression);
		if (cached !== undefined) {
			return cached;
		}
		const unwrapped = this._numeric_evaluator.unwrap(guard_expression);
		const name = this.guarded_identifier(unwrapped);
		this._guarded_names.set(guard_expression, name);
		return name;
	}

	/** Responsibilities: _preceding zero-index assignment check_. **/
	public zero_assignment_precedes(guard_statement: ts.Statement, target_name: string): boolean {
		return this.previous_statement(guard_statement, (previous) => this.assigns_zero_index(previous, target_name));
	}
}
