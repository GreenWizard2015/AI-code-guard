import ts from "typescript";
import { FakeObject } from "src/linting/test-support/fake_object";
import { ObjectCallableAliases } from "src/linting/orchestration/runtime/typescript-rule-groups/object-literal-aliases/object_callable_aliases";
import { ObjectLiteralAliases } from "src/linting/orchestration/runtime/typescript-rule-groups/object-literal-aliases/object_literal_aliases";
import { TypeScriptExpressionNames } from "src/typescript-aliases/type_script_expression_names";
import type { FakeObjectContract, ObjectCallableAliasesContract, ObjectLiteralAliasesContract } from "src/shared_services_protocols";

/** Responsibilities: _conditional callable detection_, _indexed callback detection_. **/
export class ObjectCallableExpression {
	private readonly expression_names: TypeScriptExpressionNames;
	private readonly fake_object: FakeObjectContract;
	private readonly object_aliases: ObjectLiteralAliasesContract;
	private readonly callable_aliases: ObjectCallableAliasesContract;

	/** Responsibilities: _conditional callable objects_. **/
	private conditional(expression: ts.Expression, node: ts.Node): boolean {
		if (!ts.isConditionalExpression(expression)) {
			return false;
		}
		if (this.matches(expression.whenTrue, node)) {
			return true;
		}
		return this.matches(expression.whenFalse, node);
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
	private logical(expression: ts.Expression, node: ts.Node): boolean {
		if (!ts.isBinaryExpression(expression) || !this.logical_operator(expression)) {
			return false;
		}
		if (this.matches(expression.left, node)) {
			return true;
		}
		return this.matches(expression.right, node);
	}

	/** Responsibilities: _array access index_. **/
	private array_index(expression: ts.ElementAccessExpression): number {
		if (expression.argumentExpression === undefined) {
			return -1;
		}
		const key = this.expression_names.unwrap_transparent_expression(expression.argumentExpression);
		if (!ts.isNumericLiteral(key)) {
			return -1;
		}
		return Number(key.text);
	}

	/** Responsibilities: _indexed callable object_. **/
	private array_access(expression: ts.Expression, node: ts.Node): boolean {
		if (!ts.isElementAccessExpression(expression)) {
			return false;
		}
		const index = this.array_index(expression);
		if (index < 0) {
			return false;
		}
		const target = this.expression_names.unwrap_transparent_expression(expression.expression);
		if (!ts.isArrayLiteralExpression(target)) {
			return false;
		}
		const value = target.elements[index];
		if (value === undefined) {
			return false;
		}
		return this.matches(value, node);
	}

	/** Responsibilities: _callable object property_. **/
	/** Responsibilities: _object alias dependency initialization_. **/
	public constructor() {
		this.expression_names = new TypeScriptExpressionNames();
		this.fake_object = new FakeObject();
		this.object_aliases = new ObjectLiteralAliases(this.fake_object);
		this.callable_aliases = new ObjectCallableAliases(this.fake_object);
	}

	/** Responsibilities: _object property classification_. **/
	public property(property: ts.ObjectLiteralElementLike, source: ts.Node): boolean {
		if (ts.isShorthandPropertyAssignment(property)) {
			return this.callable_aliases.contains(property.name, source);
		}
		if (!ts.isSpreadAssignment(property)) {
			return false;
		}
		const expression = this.expression_names.unwrap_transparent_expression(property.expression);
		if (this.fake_object.fake_object(expression)) {
			return true;
		}
		return this.object_aliases.contains(expression, source);
	}

	/** Responsibilities: _callable object expression_. **/
	public matches(expression: ts.Expression, node: ts.Node): boolean {
		const current = this.expression_names.unwrap_transparent_expression(expression);
		if (ts.isIdentifier(current)) {
			return this.object_aliases.contains(current, node);
		}
		if (this.array_access(current, node)) {
			return true;
		}
		if (this.conditional(current, node) || this.logical(current, node)) {
			return true;
		}
		if (this.fake_object.fake_object(current)) {
			return true;
		}
		if (!ts.isObjectLiteralExpression(current)) {
			return false;
		}
		return current.properties.some((property) => this.property(property, node));
	}
}
