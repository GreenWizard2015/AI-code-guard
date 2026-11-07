import type { StaticExpressionArrayContract } from "src/analysis_protocols";
import type { StaticArraySourceAppenderContract } from "src/analysis_protocols";
import { TypeScriptStaticArrayIndexOperation } from "src/parser/typescript-aliases/callables/static-array/type_script_static_array_index_operation";
import { TypeScriptExpressionAliases } from "src/parser/typescript-aliases/type_script_expression_aliases";
import type { TypeScriptStaticArrayIndexValuesContract } from "src/typescript_analysis_protocols";
import type { TypeScriptExpressionAliasesContract } from "src/typescript_runtime_protocols";
import type { TypeScriptObjectAliasDeclarationIndexContract } from "src/typescript_runtime_protocols";
import ts from "typescript";

/** Responsibilities: _static array index evaluation_, _indexed value collection_. **/
export class TypeScriptStaticArrayIndexValues implements TypeScriptStaticArrayIndexValuesContract {
	private readonly _expression_aliases: TypeScriptExpressionAliasesContract;
	private readonly _numeric_sources: Map<string, number>;
	private readonly _operation_categories: ReadonlyMap<ts.SyntaxKind, number>;

	/** Responsibilities: _static array index recovery_. **/
	private prefix_index(expression: ts.PrefixUnaryExpression): number {
		const value = this.numeric_index(expression.operand);
		if (value < 0) {
			return -1;
		}
		if (expression.operator === ts.SyntaxKind.PlusToken) {
			return value;
		}
		if (expression.operator === ts.SyntaxKind.MinusToken) {
			return -value;
		}
		return -1;
	}

	/** Responsibilities: _static arithmetic index_. **/
	private binary_index(expression: ts.BinaryExpression): number {
		const left = this.numeric_index(expression.left);
		const right = this.numeric_index(expression.right);
		if (left < 0 || right < 0) {
			return -1;
		}
		const operation = new TypeScriptStaticArrayIndexOperation(
			expression.operatorToken.kind,
			left,
			right,
			this._operation_categories,
		);
		if (!operation.supported()) {
			return -1;
		}
		return operation.index();
	}

	/** Responsibilities: _static conditional index_. **/
	private conditional_index(expression: ts.ConditionalExpression): number {
		const when_true = this.numeric_index(expression.whenTrue);
		const when_false = this.numeric_index(expression.whenFalse);
		if (when_true < 0 || when_true !== when_false) {
			return -1;
		}
		return when_true;
	}

	/** Responsibilities: _named static array index_. **/
	private named_index(expression: ts.Expression): number {
		if (ts.isNumericLiteral(expression)) {
			return Number(expression.text);
		}
		if (!ts.isIdentifier(expression)) {
			return -1;
		}
		const value = this._numeric_sources.get(expression.text);
		if (value === undefined) {
			return -1;
		}
		return value;
	}

	/** Responsibilities: _static array element value_. **/
	private append_selected_value(
		values: ts.Expression[],
		source: StaticExpressionArrayContract,
		index: number,
		append_source: StaticArraySourceAppenderContract,
	): boolean {
		if (!source.contains(BigInt(index))) {
			return false;
		}
		const value = source.at(BigInt(index));
		if (ts.isArrayLiteralExpression(value)) {
			return append_source.append(values, value);
		}
		if (ts.isIdentifier(value) && append_source.append(values, value)) {
			return true;
		}
		values.push(value);
		return true;
	}

	/** Responsibilities: _static array index initialization_. **/
	public constructor(
		numeric_sources: Map<string, number>,
		declaration_index: TypeScriptObjectAliasDeclarationIndexContract,
	) {
		this._expression_aliases = new TypeScriptExpressionAliases("", declaration_index);
		this._operation_categories = new Map<ts.SyntaxKind, number>([
			[ts.SyntaxKind.PlusToken, 1],
			[ts.SyntaxKind.MinusToken, 1],
			[ts.SyntaxKind.AsteriskToken, 1],
			[ts.SyntaxKind.SlashToken, 1],
			[ts.SyntaxKind.PercentToken, 1],
			[ts.SyntaxKind.BarToken, 2],
			[ts.SyntaxKind.AmpersandToken, 2],
			[ts.SyntaxKind.CaretToken, 2],
			[ts.SyntaxKind.LessThanLessThanToken, 3],
			[ts.SyntaxKind.GreaterThanGreaterThanToken, 3],
			[ts.SyntaxKind.GreaterThanGreaterThanGreaterThanToken, 3],
			[ts.SyntaxKind.AmpersandAmpersandToken, 4],
			[ts.SyntaxKind.BarBarToken, 4],
			[ts.SyntaxKind.QuestionQuestionToken, 4],
			[ts.SyntaxKind.CommaToken, 4],
		]);
		this._numeric_sources = numeric_sources;
	}

	/** Responsibilities: _static array index recovery_. **/
	public numeric_index(expression: ts.Expression): number {
		const current = this._expression_aliases.unwrapped(expression);
		if (ts.isPrefixUnaryExpression(current)) {
			return this.prefix_index(current);
		}
		if (ts.isBinaryExpression(current)) {
			return this.binary_index(current);
		}
		if (ts.isConditionalExpression(current)) {
			return this.conditional_index(current);
		}
		return this.named_index(current);
	}

	/** Responsibilities: _indexed array value collection_. **/
	public append(
		values: ts.Expression[],
		expression: ts.ElementAccessExpression,
		source: StaticExpressionArrayContract,
		append_source: StaticArraySourceAppenderContract,
	): boolean {
		const argument = expression.argumentExpression;
		if (argument === undefined) {
			return false;
		}
		const index = this.numeric_index(argument);
		if (index < 0) {
			return false;
		}
		return this.append_selected_value(values, source, index, append_source);
	}
}
