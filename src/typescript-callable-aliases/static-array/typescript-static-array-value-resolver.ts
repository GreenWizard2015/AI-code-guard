import ts from 'typescript';
import { TypeScriptExpressionAliases } from 'src/typescript-aliases/typescript-expression-aliases';
import { TypeScriptStaticArrayIndexValues } from 'src/typescript-callable-aliases/static-array/typescript-static-array-index-values';
import { TypeScriptStaticArrayMethods } from 'src/typescript-callable-aliases/static-array/typescript-static-array-methods';

/** Responsibilities: _static array values_. **/
export class TypeScriptStaticArrayValues {
	private readonly expression_aliases = new TypeScriptExpressionAliases('');
	private readonly array_methods = new TypeScriptStaticArrayMethods();
	private readonly index_values: TypeScriptStaticArrayIndexValues;
	private readonly array_sources: Map<string, readonly ts.Expression[]>;

	/** Responsibilities: _array spread resolution_. **/
	private spread_values(expression: ts.Expression): readonly ts.Expression[] {
		const current = this.expression_aliases.unwrapped(expression);
		if (ts.isArrayLiteralExpression(current)) {
			return this.array_values(current);
		}
		if (!ts.isIdentifier(current)) {
			return [];
		}
		const source = this.array_sources.get(current.text);
		if (source === undefined) {
			return [];
		}
		return source;
	}

	/** Responsibilities: _array literal flattening_. **/
	private array_values(source: ts.ArrayLiteralExpression): readonly ts.Expression[] {
		const values: ts.Expression[] = [];
		for (const element of source.elements) {
			if (ts.isSpreadElement(element)) {
				values.push(...this.spread_values(element.expression));
				continue;
			}
			values.push(element);
		}
		return values;
	}

	/** Responsibilities: _array alternative resolution_. **/
	private append_branch_values(
		values: ts.Expression[],
		left: ts.Expression,
		right: ts.Expression
	): boolean {
		let found = this.append(values, left);
		if (this.append(values, right)) {
			found = true;
		}
		return found;
	}

	/** Responsibilities: _array logical source resolution_. **/
	private append_binary_values(values: ts.Expression[], expression: ts.BinaryExpression): boolean {
		const kind = expression.operatorToken.kind;
		if (kind !== ts.SyntaxKind.AmpersandAmpersandToken && kind !== ts.SyntaxKind.BarBarToken) {
			if (kind !== ts.SyntaxKind.QuestionQuestionToken && kind !== ts.SyntaxKind.CommaToken) {
				return false;
			}
		}
		return this.append_branch_values(values, expression.left, expression.right);
	}

	/** Responsibilities: _array literal source values_. **/
	private append_literal_values(values: ts.Expression[], expression: ts.Expression): boolean {
		if (!ts.isArrayLiteralExpression(expression)) {
			return false;
		}
		values.push(...this.array_values(expression));
		return true;
	}

	/** Responsibilities: _named array source resolution_. **/
	private append_named_source(values: ts.Expression[], current: ts.Identifier): boolean {
		const source = this.array_sources.get(current.text);
		if (source === undefined) {
			return false;
		}
		values.push(...source);
		return true;
	}

	/** Responsibilities: _Array.from source collection_. **/
	private append_array_from(values: ts.Expression[], expression: ts.CallExpression): boolean {
		if (!this.array_methods.matches_array_from(expression)) {
			return false;
		}
		const arguments_list: ts.Expression[] = [];
		if (!this.append_arguments(arguments_list, expression.arguments)) {
			return false;
		}
		for (const source of arguments_list) {
			const resolved: ts.Expression[] = [];
			if (!this.append(resolved, source)) {
				return false;
			}
			values.push(...resolved);
			return true;
		}
		return false;
	}

	/** Responsibilities: _invocation argument values_. **/
	private append_arguments(values: ts.Expression[], arguments_list: readonly ts.Expression[]): boolean {
		let found = false;
		for (const argument of arguments_list) {
			if (ts.isSpreadElement(argument)) {
				if (!this.append(values, argument.expression)) {
					return false;
				}
				found = true;
				continue;
			}
			values.push(argument);
			found = true;
		}
		return found;
	}

	/** Responsibilities: _array method source values_. **/
	private append_call_values(values: ts.Expression[], expression: ts.CallExpression): boolean {
		const arguments_list: ts.Expression[] = [];
		if (this.array_methods.append(arguments_list, expression)) {
			return this.append_arguments(values, arguments_list);
		}
		return this.append_array_from(values, expression);
	}

	/** Responsibilities: _new Array source values_. **/
	private append_new_values(values: ts.Expression[], expression: ts.NewExpression): boolean {
		const arguments_list: ts.Expression[] = [];
		if (!this.array_methods.append(arguments_list, expression)) {
			return false;
		}
		return this.append_arguments(values, arguments_list);
	}

	/** Responsibilities: _array structural source values_. **/
	private append_structural_values(values: ts.Expression[], expression: ts.Expression): boolean {
		if (this.append_literal_values(values, expression)) {
			return true;
		}
		if (ts.isConditionalExpression(expression)) {
			return this.append_branch_values(values, expression.whenTrue, expression.whenFalse);
		}
		if (ts.isElementAccessExpression(expression)) {
			return this.index_values.append(values, expression, (target, source) => this.append(target, source));
		}
		if (!ts.isBinaryExpression(expression)) {
			return false;
		}
		return this.append_binary_values(values, expression);
	}

	/** Responsibilities: _array constructor source values_. **/
	private append_invocation_values(values: ts.Expression[], expression: ts.Expression): boolean {
		if (ts.isCallExpression(expression)) {
			return this.append_call_values(values, expression);
		}
		if (!ts.isNewExpression(expression)) {
			return false;
		}
		return this.append_new_values(values, expression);
	}

	/** Responsibilities: _static array source dependencies_. **/
	public constructor(
		array_sources: Map<string, readonly ts.Expression[]>,
		numeric_sources: Map<string, number>
	) {
		this.array_sources = array_sources;
		this.index_values = new TypeScriptStaticArrayIndexValues(numeric_sources);
	}

	/** Responsibilities: _array source values collection_. **/
	public append(values: ts.Expression[], expression: ts.Expression): boolean {
		const current = this.expression_aliases.unwrapped(expression);
		if (this.append_structural_values(values, current)) {
			return true;
		}
		if (ts.isCallExpression(current)) {
			return this.append_invocation_values(values, current);
		}
		if (ts.isNewExpression(current)) {
			return this.append_invocation_values(values, current);
		}
		if (!ts.isIdentifier(current)) {
			return false;
		}
		return this.append_named_source(values, current);
	}

	/** Responsibilities: _array source value lookup_. **/
	public values(expression: ts.Expression): readonly ts.Expression[] {
		const values: ts.Expression[] = [];
		this.append(values, expression);
		return values;
	}
}
