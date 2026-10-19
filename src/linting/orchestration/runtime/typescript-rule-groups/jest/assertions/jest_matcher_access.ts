import ts from "typescript";
import type { JestMatcherAccessContract } from "src/protocols";

/** Responsibilities: _Jest matcher access decoding_, _AST access memoization_. **/
export class JestMatcherAccess implements JestMatcherAccessContract {
	private readonly member_names: WeakMap<ts.Expression, string>;

	/** Responsibilities: _literal matcher member extraction_. **/
	private literal_member_name(expression: ts.Expression): string {
		if (ts.isPropertyAccessExpression(expression)) {
			return expression.name.text;
		}
		if (!ts.isElementAccessExpression(expression) || expression.argumentExpression === undefined) {
			return "";
		}
		let argument = expression.argumentExpression;
		while (ts.isParenthesizedExpression(argument)) {
			argument = argument.expression;
		}
		if (ts.isStringLiteral(argument) || ts.isNoSubstitutionTemplateLiteral(argument)) {
			return argument.text;
		}
		return "";
	}

	/** Responsibilities: _matcher access cache ownership_. **/
	public constructor() {
		this.member_names = new WeakMap<ts.Expression, string>();
	}

	/** Responsibilities: _known matcher member extraction_. **/
	public member_name(expression: ts.Expression): string {
		const cached = this.member_names.get(expression);
		if (cached !== undefined) {
			return cached;
		}
		const name = this.literal_member_name(expression);
		if (name.length > 0) {
			this.member_names.set(expression, name);
		}
		return name;
	}

	/** Responsibilities: _matcher receiver lookup_. **/
	public receiver(expression: ts.Expression): ts.Expression {
		if (ts.isPropertyAccessExpression(expression) || ts.isElementAccessExpression(expression)) {
			return expression.expression;
		}
		return expression;
	}

	/** Responsibilities: _matcher receiver availability_. **/
	public receiver_available(expression: ts.Expression): boolean {
		return ts.isPropertyAccessExpression(expression) || ts.isElementAccessExpression(expression);
	}
}
