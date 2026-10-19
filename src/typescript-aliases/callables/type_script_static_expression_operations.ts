import ts from "typescript";
import { TypeScriptExpressionNames } from "src/typescript-aliases/type_script_expression_names";
import type { StaticExpressionOperationsContract } from "src/protocols";

/** Responsibilities: _static literal resolution_, _binary and template evaluation_. **/
export class TypeScriptStaticExpressionOperations implements StaticExpressionOperationsContract {
	private readonly literal_kinds: Set<ts.SyntaxKind>;
	private readonly expression_names: TypeScriptExpressionNames;

	/** Responsibilities: _literal static value collection_. **/
	private append_literal(values: Map<string, string>, name: string, current: ts.Expression): boolean {
		if (values.has(name)) {
			return false;
		}
		if (!this.literal_kinds.has(current.kind) && !ts.isTemplateExpression(current)) {
			return false;
		}
		const value = this.literal_part(values, current);
		if (value === "") {
			return false;
		}
		values.set(name, value);
		return true;
	}

	/** Responsibilities: _static literal part resolution_. **/
	private literal_part(values: ReadonlyMap<string, string>, expression: ts.Expression): string {
		const current = this.unwrapped(expression);
		if (this.literal_kinds.has(current.kind)) {
			return this.expression_names.static_property_name(current);
		}
		if (ts.isTemplateExpression(current)) {
			return this.template_value(values, current);
		}
		if (!ts.isIdentifier(current)) {
			return "";
		}
		const value = values.get(current.text);
		if (value === undefined) {
			return "";
		}
		return value;
	}

	/** Responsibilities: _template static value resolution_. **/
	private template_value(values: ReadonlyMap<string, string>, expression: ts.TemplateExpression): string {
		let value = expression.head.text;
		for (const span of expression.templateSpans) {
			const part = this.literal_part(values, span.expression);
			if (part === "") {
				return "";
			}
			value += part + span.literal.text;
		}
		return value;
	}

	/** Responsibilities: _binary alternative scalar resolution_. **/
	private binary_branch_value(values: ReadonlyMap<string, string>, expression: ts.BinaryExpression): string {
		switch (expression.operatorToken.kind) {
			case ts.SyntaxKind.CommaToken:
				return this.branch_value(values, expression.right);
			case ts.SyntaxKind.PlusToken:
				return this.concatenated_branch_value(values, expression);
			case ts.SyntaxKind.AmpersandAmpersandToken:
			case ts.SyntaxKind.BarBarToken:
			case ts.SyntaxKind.QuestionQuestionToken:
				return this.equal_branch_value(values, expression.left, expression.right);
			default:
				return "";
		}
	}

	/** Responsibilities: _atomic branch value lookup_. **/
	private atomic_branch_value(values: ReadonlyMap<string, string>, current: ts.Expression): string {
		if (this.literal_kinds.has(current.kind) || ts.isTemplateExpression(current)) {
			return this.literal_part(values, current);
		}
		if (!ts.isIdentifier(current)) {
			return "";
		}
		const value = values.get(current.text);
		if (value === undefined) {
			return "";
		}
		return value;
	}

	/** Responsibilities: _alternative static value resolution_. **/
	private branch_value(values: ReadonlyMap<string, string>, branch: ts.Expression): string {
		const current = this.unwrapped(branch);
		const atomic_value = this.atomic_branch_value(values, current);
		if (atomic_value.length > 0) {
			return atomic_value;
		}
		if (ts.isConditionalExpression(current)) {
			return this.equal_branch_value(values, current.whenTrue, current.whenFalse);
		}
		if (ts.isBinaryExpression(current)) {
			return this.binary_branch_value(values, current);
		}
		return "";
	}

	/** Responsibilities: _equal alternative scalar value_. **/
	private equal_branch_value(values: ReadonlyMap<string, string>, left: ts.Expression, right: ts.Expression): string {
		const left_value = this.branch_value(values, left);
		if (left_value.length === 0 || left_value !== this.branch_value(values, right)) {
			return "";
		}
		return left_value;
	}

	/** Responsibilities: _concatenated branch scalar value_. **/
	private concatenated_branch_value(values: ReadonlyMap<string, string>, expression: ts.BinaryExpression): string {
		const left = this.literal_part(values, expression.left);
		if (left.length === 0) {
			return "";
		}
		const right = this.literal_part(values, expression.right);
		if (right.length === 0) {
			return "";
		}
		return left + right;
	}

	/** Responsibilities: _equal alternative value resolution_. **/
	private append_branch(values: Map<string, string>, name: string, left: ts.Expression, right: ts.Expression): boolean {
		if (values.has(name)) {
			return false;
		}
		const value = this.equal_branch_value(values, left, right);
		if (value.length === 0) {
			return false;
		}
		values.set(name, value);
		return true;
	}

	/** Responsibilities: _literal concatenation collection_. **/
	private append_concat(values: Map<string, string>, name: string, expression: ts.BinaryExpression): boolean {
		if (values.has(name)) {
			return false;
		}
		const left = this.literal_part(values, expression.left);
		const right = this.literal_part(values, expression.right);
		if (left === "" || right === "") {
			return false;
		}
		values.set(name, left + right);
		return true;
	}

	/** Responsibilities: _logical static value resolution_. **/
	private append_binary(values: Map<string, string>, name: string, expression: ts.BinaryExpression): boolean {
		const kind = expression.operatorToken.kind;
		if (kind === ts.SyntaxKind.PlusToken) {
			return this.append_concat(values, name, expression);
		}
		if (kind !== ts.SyntaxKind.AmpersandAmpersandToken && kind !== ts.SyntaxKind.BarBarToken) {
			if (kind !== ts.SyntaxKind.QuestionQuestionToken && kind !== ts.SyntaxKind.CommaToken) {
				return false;
			}
		}
		if (kind === ts.SyntaxKind.CommaToken) {
			return this.append(values, name, expression.right);
		}
		return this.append_branch(values, name, expression.left, expression.right);
	}

	/** Responsibilities: _identifier static value resolution_. **/
	private append_identifier(values: Map<string, string>, name: string, current: ts.Identifier): boolean {
		const value = values.get(current.text);
		if (value === undefined) {
			return false;
		}
		if (values.has(name)) {
			return false;
		}
		values.set(name, value);
		return true;
	}

	/** Responsibilities: _transparent static expression unwrapping_. **/
	/** Responsibilities: _field initialization_. **/
	constructor() {
		this.literal_kinds = new Set([
			ts.SyntaxKind.StringLiteral,
			ts.SyntaxKind.NoSubstitutionTemplateLiteral,
			ts.SyntaxKind.NumericLiteral,
		]);
		this.expression_names = new TypeScriptExpressionNames();
	}
	/** Responsibilities: _public operation_. **/
	public unwrapped(expression: ts.Expression): ts.Expression {
		while (true) {
			if (ts.isParenthesizedExpression(expression)) {
				expression = expression.expression;
				continue;
			}
			if (ts.isNonNullExpression(expression) || ts.isAsExpression(expression)) {
				expression = expression.expression;
				continue;
			}
			if (ts.isTypeAssertionExpression(expression) || ts.isSatisfiesExpression(expression)) {
				expression = expression.expression;
				continue;
			}
			return expression;
		}
	}

	/** Responsibilities: _static literal resolution_. **/
	public literal(values: ReadonlyMap<string, string>, expression: ts.Expression): string {
		const current = this.unwrapped(expression);
		if (this.literal_kinds.has(current.kind)) {
			return this.expression_names.static_property_name(current);
		}
		if (!ts.isTemplateExpression(current)) {
			return "";
		}
		return this.template_value(values, current);
	}

	/** Responsibilities: _static expression value collection_. **/
	public append(values: Map<string, string>, name: string, initializer: ts.Expression): boolean {
		const current = this.unwrapped(initializer);
		if (this.append_literal(values, name, current)) {
			return true;
		}
		if (ts.isConditionalExpression(current)) {
			return this.append_branch(values, name, current.whenTrue, current.whenFalse);
		}
		if (ts.isBinaryExpression(current)) {
			return this.append_binary(values, name, current);
		}
		if (!ts.isIdentifier(current)) {
			return false;
		}
		return this.append_identifier(values, name, current);
	}
}
