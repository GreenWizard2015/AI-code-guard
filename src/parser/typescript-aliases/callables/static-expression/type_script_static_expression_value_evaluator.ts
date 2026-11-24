import type { ExpressionNamesContract } from "src/runtime_protocols";
import type { StaticExpressionOperationsContract } from "src/shared_services_protocols";
import type { TypeScriptExpressionValueQuery } from "src/typescript_analysis_protocols";
import ts from "typescript";

/** Responsibilities: _static expression value evaluation_, _branch equivalence resolution_. **/
export class TypeScriptStaticExpressionValueEvaluator {
	private readonly _values: ReadonlyMap<string, string>;
	private readonly _operations: StaticExpressionOperationsContract;
	private readonly _literal_kinds: ReadonlySet<ts.SyntaxKind>;
	private readonly _expression_names: ExpressionNamesContract;

	/** Responsibilities: _static literal component lookup_. **/
	private literal_part(query: TypeScriptExpressionValueQuery): string {
		const { expression } = query;
		const current = this._operations.unwrapped(expression);
		if (this._literal_kinds.has(current.kind)) {
			return this._expression_names.static_property_name(current);
		}
		if (ts.isTemplateExpression(current)) {
			return this.template_value(current);
		}
		if (!ts.isIdentifier(current)) {
			return "";
		}
		const value = this._values.get(current.text);
		if (value === undefined) {
			return "";
		}
		return value;
	}

	/** Responsibilities: _template literal value resolution_. **/
	private template_value(expression: ts.TemplateExpression): string {
		let value = expression.head.text;
		for (const span of expression.templateSpans) {
			const part = this.literal_part({ expression: span.expression });
			if (part === "") {
				return "";
			}
			value += part + span.literal.text;
		}
		return value;
	}

	/** Responsibilities: _binary branch value resolution_. **/
	private binary_branch_value(expression: ts.BinaryExpression): string {
		switch (expression.operatorToken.kind) {
			case ts.SyntaxKind.CommaToken:
				return this.branch_value(expression.right);
			case ts.SyntaxKind.PlusToken:
				return this.concatenated_branch_value(expression);
			case ts.SyntaxKind.AmpersandAmpersandToken:
			case ts.SyntaxKind.BarBarToken:
			case ts.SyntaxKind.QuestionQuestionToken:
				return this.equal_branch_value(expression.left, expression.right);
			default:
				return "";
		}
	}

	/** Responsibilities: _atomic branch value lookup_. **/
	private atomic_branch_value(query: TypeScriptExpressionValueQuery): string {
		const { expression } = query;
		if (this._literal_kinds.has(expression.kind) || ts.isTemplateExpression(expression)) {
			return this.literal_part({ expression });
		}
		if (!ts.isIdentifier(expression)) {
			return "";
		}
		const value = this._values.get(expression.text);
		if (value === undefined) {
			return "";
		}
		return value;
	}

	/** Responsibilities: _alternative static value resolution_. **/
	private branch_value(branch: ts.Expression): string {
		const current = this._operations.unwrapped(branch);
		const atomic_value = this.atomic_branch_value({ expression: current });
		if (atomic_value.length > 0) {
			return atomic_value;
		}
		if (ts.isConditionalExpression(current)) {
			return this.equal_branch_value(current.whenTrue, current.whenFalse);
		}
		if (ts.isBinaryExpression(current)) {
			return this.binary_branch_value(current);
		}
		return "";
	}

	/** Responsibilities: _equal branch value resolution_. **/
	private equal_branch_value(left: ts.Expression, right: ts.Expression): string {
		const left_value = this.branch_value(left);
		if (left_value.length === 0 || left_value !== this.branch_value(right)) {
			return "";
		}
		return left_value;
	}

	/** Responsibilities: _concatenated branch value resolution_. **/
	private concatenated_branch_value(expression: ts.BinaryExpression): string {
		const left = this.literal_part({ expression: expression.left });
		if (left.length === 0) {
			return "";
		}
		const right = this.literal_part({ expression: expression.right });
		if (right.length === 0) {
			return "";
		}
		return left + right;
	}

	/** Responsibilities: _expression value evaluation context_. **/
	public constructor(
		values: ReadonlyMap<string, string>,
		operations: StaticExpressionOperationsContract,
		literal_kinds: ReadonlySet<ts.SyntaxKind>,
		expression_names: ExpressionNamesContract,
	) {
		this._values = values;
		this._operations = operations;
		this._literal_kinds = literal_kinds;
		this._expression_names = expression_names;
	}

	/** Responsibilities: _static expression branch value_. **/
	public value(expression: ts.Expression): string {
		const current = this._operations.unwrapped(expression);
		const atomic_value = this.atomic_branch_value({ expression: current });
		if (atomic_value.length > 0) {
			return atomic_value;
		}
		if (ts.isConditionalExpression(current)) {
			return this.equal_branch_value(current.whenTrue, current.whenFalse);
		}
		if (ts.isBinaryExpression(current)) {
			return this.binary_branch_value(current);
		}
		return "";
	}

	/** Responsibilities: _static literal value_. **/
	public literal(expression: ts.Expression): string {
		const current = this._operations.unwrapped(expression);
		if (this._literal_kinds.has(current.kind)) {
			return this._expression_names.static_property_name(current);
		}
		if (!ts.isTemplateExpression(current)) {
			return "";
		}
		return this.template_value(current);
	}
}
