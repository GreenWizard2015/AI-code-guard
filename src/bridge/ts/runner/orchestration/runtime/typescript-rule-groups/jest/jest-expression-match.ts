import ts from 'typescript';

/** Responsibilities: _storage matched Jest expression_, _report value availability_. **/
export class JestExpressionMatch {
	private readonly expression: ts.Expression;
	private readonly available: boolean;

	/** Responsibilities: _expression match state initialization_. **/
	public constructor(expression: ts.Expression, available: boolean) {
		this.expression = expression;
		this.available = available;
	}

	/** Responsibilities: _reporting matched value available_. **/
	public value_available(): boolean {
		if (!this.available) {
			return false;
		}
		return true;
	}

	/** Responsibilities: _output matched expression_. **/
	public value(): ts.Expression {
		if (!this.available) {
			throw new Error('Jest expression is not available.');
		}
		return this.expression;
	}
}
