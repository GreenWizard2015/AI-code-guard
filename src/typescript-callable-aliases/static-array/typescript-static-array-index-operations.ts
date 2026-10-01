import ts from "typescript";

/** Responsibilities: _static index operations_. **/
export class TypeScriptStaticArrayIndexOperations {
	private readonly operation_categories = new Map<ts.SyntaxKind, number>([
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

	/** Responsibilities: _arithmetic index operation_. **/
	private arithmetic(kind: ts.SyntaxKind, left: number, right: number): number {
		if (kind === ts.SyntaxKind.PlusToken) {
			return left + right;
		}
		if (kind === ts.SyntaxKind.MinusToken) {
			return left - right;
		}
		if (kind === ts.SyntaxKind.AsteriskToken) {
			return left * right;
		}
		if (kind === ts.SyntaxKind.SlashToken) {
			return left / right;
		}
		return left % right;
	}

	/** Responsibilities: _bitwise index operation_. **/
	private bitwise(kind: ts.SyntaxKind, left: number, right: number): number {
		if (kind === ts.SyntaxKind.BarToken) {
			return left | right;
		}
		if (kind === ts.SyntaxKind.AmpersandToken) {
			return left & right;
		}
		return left ^ right;
	}

	/** Responsibilities: _shift index operation_. **/
	private shift(kind: ts.SyntaxKind, left: number, right: number): number {
		if (kind === ts.SyntaxKind.LessThanLessThanToken) {
			return left << right;
		}
		if (kind === ts.SyntaxKind.GreaterThanGreaterThanToken) {
			return left >> right;
		}
		return left >>> right;
	}

	/** Responsibilities: _logical index operation_. **/
	private logical(kind: ts.SyntaxKind, left: number, right: number): number {
		if (kind === ts.SyntaxKind.AmpersandAmpersandToken) {
			if (left === 0) {
				return left;
			}
			return right;
		}
		if (kind === ts.SyntaxKind.BarBarToken) {
			if (left !== 0) {
				return left;
			}
			return right;
		}
		if (kind === ts.SyntaxKind.QuestionQuestionToken) {
			return left;
		}
		return right;
	}

	/** Responsibilities: _supported index operations_. **/
	public supports(kind: ts.SyntaxKind): boolean {
		const category = this.operation_categories.get(kind);
		if (category === undefined) {
			return false;
		}
		return category > 0;
	}

	/** Responsibilities: _static index calculation_. **/
	public resolve(kind: ts.SyntaxKind, left: number, right: number): number {
		const category = this.operation_categories.get(kind);

		if (category === 1) {
			return this.arithmetic(kind, left, right);
		}
		if (category === 2) {
			return this.bitwise(kind, left, right);
		}
		if (category === 3) {
			return this.shift(kind, left, right);
		}
		return this.logical(kind, left, right);
	}
}
