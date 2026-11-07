import ts from "typescript";

/** Responsibilities: _binary index evaluation_, _operator category evaluation_. **/
export class TypeScriptStaticArrayIndexOperation {
	private readonly _kind: ts.SyntaxKind;
	private readonly _left: number;
	private readonly _right: number;
	private readonly _categories: ReadonlyMap<ts.SyntaxKind, number>;

	/** Responsibilities: _index arithmetic evaluation_. **/
	private arithmetic(): number {
		if (this._kind === ts.SyntaxKind.PlusToken) {
			return this._left + this._right;
		}
		if (this._kind === ts.SyntaxKind.MinusToken) {
			return this._left - this._right;
		}
		if (this._kind === ts.SyntaxKind.AsteriskToken) {
			return this._left * this._right;
		}
		if (this._kind === ts.SyntaxKind.SlashToken) {
			return this._left / this._right;
		}
		return this._left % this._right;
	}

	/** Responsibilities: _index bitwise evaluation_. **/
	private bitwise(): number {
		if (this._kind === ts.SyntaxKind.BarToken) {
			return this._left | this._right;
		}
		if (this._kind === ts.SyntaxKind.AmpersandToken) {
			return this._left & this._right;
		}
		return this._left ^ this._right;
	}

	/** Responsibilities: _index shift evaluation_. **/
	private shift(): number {
		if (this._kind === ts.SyntaxKind.LessThanLessThanToken) {
			return this._left << this._right;
		}
		if (this._kind === ts.SyntaxKind.GreaterThanGreaterThanToken) {
			return this._left >> this._right;
		}
		return this._left >>> this._right;
	}

	/** Responsibilities: _index logical evaluation_. **/
	private logical(): number {
		if (this._kind === ts.SyntaxKind.AmpersandAmpersandToken) {
			if (this._left === 0) {
				return this._left;
			}
			return this._right;
		}
		if (this._kind === ts.SyntaxKind.BarBarToken) {
			if (this._left !== 0) {
				return this._left;
			}
			return this._right;
		}
		if (this._kind === ts.SyntaxKind.QuestionQuestionToken) {
			return this._left;
		}
		return this._right;
	}

	/** Responsibilities: _binary index result_. **/
	private value(): number {
		const category = this._categories.get(this._kind);
		if (category === 1) {
			return this.arithmetic();
		}
		if (category === 2) {
			return this.bitwise();
		}
		if (category === 3) {
			return this.shift();
		}
		return this.logical();
	}

	/** Responsibilities: _binary index setup_. **/
	public constructor(kind: ts.SyntaxKind, left: number, right: number, categories: ReadonlyMap<ts.SyntaxKind, number>) {
		this._kind = kind;
		this._left = left;
		this._right = right;
		this._categories = categories;
	}

	/** Responsibilities: _index operation support check_. **/
	public supported(): boolean {
		const category = this._categories.get(this._kind);
		return category !== undefined && category > 0;
	}

	/** Responsibilities: _valid index calculation_. **/
	public index(): number {
		const value = this.value();
		if (!Number.isInteger(value) || value < 0) {
			return -1;
		}
		return value;
	}
}
