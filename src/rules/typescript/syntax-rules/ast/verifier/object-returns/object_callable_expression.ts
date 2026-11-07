import type { ExpressionNamesContract } from "src/runtime_protocols";
import type { FakeObjectContract, ObjectCallableAliasesContract } from "src/shared_services_protocols";
import type { ObjectLiteralAliasesContract } from "src/shared_services_protocols";
import ts from "typescript";

/** Responsibilities: _conditional callable detection_, _indexed callback detection_. **/
export class ObjectCallableExpression {
	private readonly _expression_names: ExpressionNamesContract;
	private readonly _fake_object: FakeObjectContract;
	private readonly _object_aliases: ObjectLiteralAliasesContract;
	private readonly _callable_aliases: ObjectCallableAliasesContract;
	private readonly _return_statement: ts.ReturnStatement;

	/** Responsibilities: _conditional callable detection_. **/
	private conditional(condition: ts.Expression): boolean {
		if (!ts.isConditionalExpression(condition)) {
			return false;
		}
		if (this.matches(condition.whenTrue)) {
			return true;
		}
		return this.matches(condition.whenFalse);
	}

	/** Responsibilities: _logical operator classification_. **/
	private logical_operator(expression: ts.BinaryExpression): boolean {
		if (expression.operatorToken.kind === ts.SyntaxKind.AmpersandAmpersandToken) {
			return true;
		}
		if (expression.operatorToken.kind === ts.SyntaxKind.BarBarToken) {
			return true;
		}
		if (expression.operatorToken.kind === ts.SyntaxKind.QuestionQuestionToken) {
			return true;
		}
		return expression.operatorToken.kind === ts.SyntaxKind.CommaToken;
	}

	/** Responsibilities: _logical callable objects_. **/
	private logical(binary_expression: ts.Expression): boolean {
		if (!ts.isBinaryExpression(binary_expression) || !this.logical_operator(binary_expression)) {
			return false;
		}
		if (this.matches(binary_expression.left)) {
			return true;
		}
		return this.matches(binary_expression.right);
	}

	/** Responsibilities: _array access index_. **/
	private array_index(expression: ts.ElementAccessExpression): number {
		if (expression.argumentExpression === undefined) {
			return -1;
		}
		const key = this._expression_names.unwrap_transparent_expression(expression.argumentExpression);
		if (!ts.isNumericLiteral(key)) {
			return -1;
		}
		return Number(key.text);
	}

	/** Responsibilities: _indexed callable object_. **/
	private array_access(indexed_expression: ts.Expression): boolean {
		if (!ts.isElementAccessExpression(indexed_expression)) {
			return false;
		}
		const index = this.array_index(indexed_expression);
		if (index < 0) {
			return false;
		}
		const target = this._expression_names.unwrap_transparent_expression(indexed_expression.expression);
		if (!ts.isArrayLiteralExpression(target)) {
			return false;
		}
		const value = target.elements[index];
		if (value === undefined) {
			return false;
		}
		return this.matches(value);
	}

	/** Responsibilities: _property callback detection_. **/
	private property_assignment(property: ts.PropertyAssignment): boolean {
		const initializer = this._expression_names.unwrap_transparent_expression(property.initializer);
		if (ts.isArrowFunction(initializer) || ts.isFunctionExpression(initializer)) {
			return true;
		}
		if (!ts.isIdentifier(initializer)) {
			return false;
		}
		return this._callable_aliases.contains(initializer, this._return_statement);
	}

	/** Responsibilities: _spread callable object_. **/
	private spread_assignment(property: ts.SpreadAssignment): boolean {
		const expression = this._expression_names.unwrap_transparent_expression(property.expression);
		if (this._fake_object.fake_object(expression)) {
			return true;
		}
		return this._object_aliases.contains(expression, this._return_statement);
	}

	/** Responsibilities: _callable object property_. **/
	private property(property: ts.ObjectLiteralElementLike): boolean {
		if (ts.isMethodDeclaration(property) || ts.isGetAccessor(property) || ts.isSetAccessor(property)) {
			return true;
		}
		if (ts.isShorthandPropertyAssignment(property)) {
			return this._callable_aliases.contains(property.name, this._return_statement);
		}
		if (ts.isPropertyAssignment(property)) {
			return this.property_assignment(property);
		}
		if (ts.isSpreadAssignment(property)) {
			return this.spread_assignment(property);
		}
		return false;
	}

	/** Responsibilities: _callable object dependencies_. **/
	public constructor(
		expression_names: ExpressionNamesContract,
		fake_object: FakeObjectContract,
		object_aliases: ObjectLiteralAliasesContract,
		callable_aliases: ObjectCallableAliasesContract,
		return_statement: ts.ReturnStatement,
	) {
		this._expression_names = expression_names;
		this._fake_object = fake_object;
		this._object_aliases = object_aliases;
		this._callable_aliases = callable_aliases;
		this._return_statement = return_statement;
	}

	/** Responsibilities: _callable object expression_. **/
	public matches(candidate_expression: ts.Expression): boolean {
		const current = this._expression_names.unwrap_transparent_expression(candidate_expression);
		if (ts.isIdentifier(current)) {
			return this._object_aliases.contains(current, this._return_statement);
		}
		if (this.array_access(current)) {
			return true;
		}
		if (this.conditional(current) || this.logical(current)) {
			return true;
		}
		if (!ts.isObjectLiteralExpression(current)) {
			return false;
		}
		return current.properties.some((property) => this.property(property));
	}

	/** Responsibilities: _callable object match result_. **/
	public matches_return(): boolean {
		const expression = this._return_statement.expression;
		if (expression === undefined) {
			return false;
		}
		return this.matches(expression);
	}
}
