import type { StaticExpressionArrayContract } from "src/analysis_protocols";
import { StaticExpressionArray } from "src/parser/typescript-aliases/callables/static-array/static_expression_array";
import type {
	TypeScriptStaticArrayExpressionTarget,
	TypeScriptStaticArrayIndexValuesContract,
	TypeScriptStaticArrayStructureContract,
	TypeScriptStaticArrayValuesContract,
} from "src/typescript_analysis_protocols";
import ts from "typescript";

/** Responsibilities: _structural array expression expansion_, _composed sequence reconstruction_. **/
export class TypeScriptStaticArrayStructure implements TypeScriptStaticArrayStructureContract {
	private readonly _array_sources: Map<string, StaticExpressionArrayContract>;
	private readonly _index_values: TypeScriptStaticArrayIndexValuesContract;
	private readonly _owner: TypeScriptStaticArrayValuesContract;

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

	/** Responsibilities: _indexed element reconstruction_. **/
	private selected_sequence(selected: ts.Expression): StaticExpressionArrayContract {
		if (ts.isArrayLiteralExpression(selected)) {
			return this._owner.sequence(selected);
		}
		if (ts.isIdentifier(selected)) {
			const alias = this._array_sources.get(selected.text);
			if (alias !== undefined) {
				return alias;
			}
		}
		return new StaticExpressionArray([selected], []);
	}

	/** Responsibilities: _indexed array sequence_. **/
	private indexed_sequence(expression: ts.ElementAccessExpression): StaticExpressionArrayContract {
		const index_expression = expression.argumentExpression;
		if (index_expression === undefined) {
			return new StaticExpressionArray([], []);
		}
		const index = this._index_values.numeric_index(index_expression);
		const source = this._owner.sequence(expression.expression);
		if (index < 0 || !source.contains(BigInt(index))) {
			return new StaticExpressionArray([], []);
		}
		return this.selected_sequence(source.at(BigInt(index)));
	}

	/** Responsibilities: _conditional array alternatives_. **/
	private append_conditional(
		target: TypeScriptStaticArrayExpressionTarget,
		expression: ts.ConditionalExpression,
	): boolean {
		const { values } = target;
		let found = this._owner.append(values, expression.whenTrue);
		if (this._owner.append(values, expression.whenFalse)) {
			found = true;
		}
		return found;
	}

	/** Responsibilities: _binary array alternatives_. **/
	private append_binary(target: TypeScriptStaticArrayExpressionTarget, expression: ts.BinaryExpression): boolean {
		const { values } = target;
		if (!this.array_value_operator(expression.operatorToken.kind)) {
			return false;
		}
		const parts = [this._owner.sequence(expression.left), this._owner.sequence(expression.right)];
		const sequence = new StaticExpressionArray([], parts);
		sequence.append_to(values);
		return true;
	}

	/** Responsibilities: _binary array sequence_. **/
	private binary_sequence(expression: ts.BinaryExpression): StaticExpressionArrayContract {
		if (!this.array_value_operator(expression.operatorToken.kind)) {
			return new StaticExpressionArray([], []);
		}
		const parts = [this._owner.sequence(expression.left), this._owner.sequence(expression.right)];
		return new StaticExpressionArray([], parts);
	}

	/** Responsibilities: _structural array dependencies_. **/
	public constructor(
		array_sources: Map<string, StaticExpressionArrayContract>,
		index_values: TypeScriptStaticArrayIndexValuesContract,
		owner: TypeScriptStaticArrayValuesContract,
	) {
		this._array_sources = array_sources;
		this._index_values = index_values;
		this._owner = owner;
	}

	/** Responsibilities: _structural array value expansion_. **/
	public append(values: ts.Expression[], expression: ts.Expression): boolean {
		if (ts.isArrayLiteralExpression(expression)) {
			this._owner.sequence(expression).append_to(values);
			return true;
		}
		if (ts.isConditionalExpression(expression)) {
			return this.append_conditional({ values }, expression);
		}
		if (ts.isElementAccessExpression(expression)) {
			return this._index_values.append(values, expression, this._owner.sequence(expression.expression), this._owner);
		}
		if (ts.isBinaryExpression(expression)) {
			return this.append_binary({ values }, expression);
		}
		return false;
	}

	/** Responsibilities: _composed array expression sequence_. **/
	public sequence(expression: ts.Expression): StaticExpressionArrayContract {
		if (ts.isConditionalExpression(expression)) {
			const parts = [this._owner.sequence(expression.whenTrue), this._owner.sequence(expression.whenFalse)];
			return new StaticExpressionArray([], parts);
		}
		if (ts.isBinaryExpression(expression)) {
			return this.binary_sequence(expression);
		}
		if (ts.isElementAccessExpression(expression)) {
			return this.indexed_sequence(expression);
		}
		const values: ts.Expression[] = [];
		this._owner.append(values, expression);
		return new StaticExpressionArray(values, []);
	}
}
