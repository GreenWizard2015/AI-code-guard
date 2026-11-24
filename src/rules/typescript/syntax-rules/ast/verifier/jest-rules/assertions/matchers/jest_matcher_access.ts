import type { JestMatcherAccessContract } from "src/testing_protocols";
import ts from "typescript";

/** Responsibilities: _Jest matcher access decoding_, _AST access memoization_. **/
export class JestMatcherAccess implements JestMatcherAccessContract {
	private readonly _member_names: WeakMap<ts.Expression, string>;

	/** Responsibilities: _literal matcher member extraction_. **/
	private literal_member_name(member_access: ts.Expression): string {
		if (ts.isPropertyAccessExpression(member_access)) {
			return member_access.name.text;
		}
		if (!ts.isElementAccessExpression(member_access) || member_access.argumentExpression === undefined) {
			return "";
		}
		let argument = member_access.argumentExpression;
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
		this._member_names = new WeakMap<ts.Expression, string>();
	}

	/** Responsibilities: _known matcher member extraction_. **/
	public member_name(access_expression: ts.Expression): string {
		const cached = this._member_names.get(access_expression);
		if (cached !== undefined) {
			return cached;
		}
		const name = this.literal_member_name(access_expression);
		if (name.length > 0) {
			this._member_names.set(access_expression, name);
		}
		return name;
	}

	/** Responsibilities: _matcher receiver lookup_. **/
	public receiver(receiver_source: ts.Expression): ts.Expression {
		if (ts.isPropertyAccessExpression(receiver_source) || ts.isElementAccessExpression(receiver_source)) {
			return receiver_source.expression;
		}
		return receiver_source;
	}

	/** Responsibilities: _matcher receiver availability_. **/
	public receiver_available(candidate: ts.Expression): boolean {
		return ts.isPropertyAccessExpression(candidate) || ts.isElementAccessExpression(candidate);
	}
}
