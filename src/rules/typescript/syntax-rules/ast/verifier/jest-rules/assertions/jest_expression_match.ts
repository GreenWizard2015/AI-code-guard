import type { JestExpressionMatchContract } from "src/testing_protocols";
import type ts from "typescript";

/** Responsibilities: _storage matched Jest expression_, _report value availability_. **/
export class JestExpressionMatch implements JestExpressionMatchContract {
	private readonly _expression: ts.Expression;
	private readonly _available: boolean;

	/** Responsibilities: _expression match state initialization_. **/
	public constructor(expression: ts.Expression, available: boolean) {
		this._expression = expression;
		this._available = available;
	}

	/** Responsibilities: _reporting matched value available_. **/
	public value_available(): boolean {
		if (!this._available) {
			return false;
		}
		return true;
	}

	/** Responsibilities: _output matched expression_. **/
	public value(): ts.Expression {
		if (!this._available) {
			throw new Error("Jest expression is not available.");
		}
		return this._expression;
	}
}
