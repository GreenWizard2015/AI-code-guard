import ts from "typescript";
import { StaticExpressionArray } from "src/static_expression_array";
import type {
	StaticArrayExpressionOwnerContract,
	StaticExpressionArrayContract,
	TypeScriptStaticArrayIndexValuesContract,
	TypeScriptStaticArrayValuesContract,
	TypeScriptStaticArrayStructureContract,
} from "src/protocols";

/** Responsibilities: _structural array expression expansion_, _composed sequence reconstruction_. **/
export class TypeScriptStaticArrayStructure implements TypeScriptStaticArrayStructureContract {
	private readonly array_sources: Map<string, StaticExpressionArrayContract>;
	private readonly index_values: TypeScriptStaticArrayIndexValuesContract;

	/** Responsibilities: _array value operator classification_. **/
	private array_value_operator(kind: ts.SyntaxKind): boolean {
		switch (kind) {
			case ts.SyntaxKind.AmpersandAmpersandToken:
			case ts.SyntaxKind.BarBarToken:
			case ts.SyntaxKind.QuestionQuestionToken:
			case ts.SyntaxKind.CommaToken:
				return true;
			default:
				return false;
		}
	}

	/** Responsibilities: _binary array value sequence_. **/
	private binary_sequence(
		expression: ts.BinaryExpression,
		owner: StaticArrayExpressionOwnerContract,
	): StaticExpressionArrayContract {
		if (!this.array_value_operator(expression.operatorToken.kind)) {
			return new StaticExpressionArray([], [], 0n);
		}
		const parts = [owner.sequence(expression.left), owner.sequence(expression.right)];
		return new StaticExpressionArray(
			[],
			parts,
			parts.reduce((size, part) => size + part.size, 0n),
		);
	}

	/** Responsibilities: _indexed element reconstruction_. **/
	private selected_sequence(
		selected: ts.Expression,
		owner: TypeScriptStaticArrayValuesContract,
	): StaticExpressionArrayContract {
		if (ts.isArrayLiteralExpression(selected)) {
			return owner.sequence(selected);
		}
		if (ts.isIdentifier(selected)) {
			const alias = this.array_sources.get(selected.text);
			if (alias !== undefined) {
				return alias;
			}
		}
		return new StaticExpressionArray([selected], [], 1n);
	}

	/** Responsibilities: _conditional array values_. **/
	private append_conditional(
		values: ts.Expression[],
		expression: ts.ConditionalExpression,
		owner: StaticArrayExpressionOwnerContract,
	): boolean {
		let found = owner.append(values, expression.whenTrue);
		if (owner.append(values, expression.whenFalse)) {
			found = true;
		}
		return found;
	}

	/** Responsibilities: _indexed array sequence_. **/
	private indexed_sequence(
		expression: ts.ElementAccessExpression,
		owner: TypeScriptStaticArrayValuesContract,
	): StaticExpressionArrayContract {
		const index_expression = expression.argumentExpression;
		if (index_expression === undefined) {
			return new StaticExpressionArray([], [], 0n);
		}
		const index = this.index_values.numeric_index(index_expression);
		const source = owner.sequence(expression.expression);
		if (index < 0 || !source.contains(BigInt(index))) {
			return new StaticExpressionArray([], [], 0n);
		}
		return this.selected_sequence(source.at(BigInt(index)), owner);
	}

	/** Responsibilities: _binary array value expansion_. **/
	private append_binary(
		values: ts.Expression[],
		expression: ts.BinaryExpression,
		owner: StaticArrayExpressionOwnerContract,
	): boolean {
		if (!this.array_value_operator(expression.operatorToken.kind)) {
			return false;
		}
		this.binary_sequence(expression, owner).append_to(values);
		return true;
	}

	/** Responsibilities: _structural array dependencies_. **/
	public constructor(
		array_sources: Map<string, StaticExpressionArrayContract>,
		index_values: TypeScriptStaticArrayIndexValuesContract,
	) {
		this.array_sources = array_sources;
		this.index_values = index_values;
	}

	/** Responsibilities: _structural array value expansion_. **/
	public append(
		values: ts.Expression[],
		expression: ts.Expression,
		owner: StaticArrayExpressionOwnerContract,
	): boolean {
		if (ts.isArrayLiteralExpression(expression)) {
			owner.sequence(expression).append_to(values);
			return true;
		}
		if (ts.isConditionalExpression(expression)) {
			return this.append_conditional(values, expression, owner);
		}
		if (ts.isElementAccessExpression(expression)) {
			return this.index_values.append(values, expression, owner.sequence(expression.expression), owner);
		}
		if (ts.isBinaryExpression(expression)) {
			return this.append_binary(values, expression, owner);
		}
		return false;
	}

	/** Responsibilities: _composed array expression sequence_. **/
	public sequence(expression: ts.Expression, owner: StaticArrayExpressionOwnerContract): StaticExpressionArrayContract {
		if (ts.isConditionalExpression(expression)) {
			const parts = [owner.sequence(expression.whenTrue), owner.sequence(expression.whenFalse)];
			return new StaticExpressionArray(
				[],
				parts,
				parts.reduce((size, part) => size + part.size, 0n),
			);
		}
		if (ts.isBinaryExpression(expression)) {
			return this.binary_sequence(expression, owner);
		}
		if (ts.isElementAccessExpression(expression)) {
			return this.indexed_sequence(expression, owner);
		}
		const values: ts.Expression[] = [];
		owner.append(values, expression);
		return new StaticExpressionArray(values, [], BigInt(values.length));
	}
}
