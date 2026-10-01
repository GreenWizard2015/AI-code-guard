import ts from "typescript";
import { TypeScriptExpressionAliases } from "src/typescript-aliases/typescript-expression-aliases";

/** Responsibilities: _static expression operation resolution_. **/
export class TypeScriptStaticExpressionOperations {
	private readonly expression_aliases = new TypeScriptExpressionAliases("");
	private readonly literal_kinds = new Set([
		ts.SyntaxKind.StringLiteral,
		ts.SyntaxKind.NoSubstitutionTemplateLiteral,
		ts.SyntaxKind.NumericLiteral,
	]);

	/** Responsibilities: _literal static value collection_. **/
	private append_literal(values: Map<string, string>, name: string, current: ts.Expression): boolean {
		if (values.has(name)) {
			return false;
		}
		if (!this.literal_kinds.has(current.kind) && !ts.isTemplateExpression(current)) {
			return false;
		}
		const value = this.literal_part(values, current);
		if (value === "") {
			return false;
		}
		values.set(name, value);
		return true;
	}

	/** Responsibilities: _static literal part resolution_. **/
	private literal_part(values: ReadonlyMap<string, string>, expression: ts.Expression): string {
		const current = this.expression_aliases.unwrapped(expression);
		if (this.literal_kinds.has(current.kind)) {
			return current.getText().replace(/^['"`]|['"`]$/g, "");
		}
		if (ts.isTemplateExpression(current)) {
			return this.template_value(values, current);
		}
		if (!ts.isIdentifier(current)) {
			return "";
		}
		const value = values.get(current.text);
		if (value === undefined) {
			return "";
		}
		return value;
	}

	/** Responsibilities: _template static value resolution_. **/
	private template_value(values: ReadonlyMap<string, string>, expression: ts.TemplateExpression): string {
		let value = expression.head.text;
		for (const span of expression.templateSpans) {
			const part = this.literal_part(values, span.expression);
			if (part === "") {
				return "";
			}
			value += part + span.literal.text;
		}
		return value;
	}

	/** Responsibilities: _alternative static value resolution_. **/
	private append_branch(values: Map<string, string>, name: string, left: ts.Expression, right: ts.Expression): boolean {
		let changed = this.append(values, name, left);
		if (this.append(values, name, right)) {
			changed = true;
		}
		return changed;
	}

	/** Responsibilities: _literal concatenation collection_. **/
	private append_concat(values: Map<string, string>, name: string, expression: ts.BinaryExpression): boolean {
		if (values.has(name)) {
			return false;
		}
		const left = this.literal_part(values, expression.left);
		const right = this.literal_part(values, expression.right);
		if (left === "" || right === "") {
			return false;
		}
		values.set(name, left + right);
		return true;
	}

	/** Responsibilities: _logical static value resolution_. **/
	private append_binary(values: Map<string, string>, name: string, expression: ts.BinaryExpression): boolean {
		const kind = expression.operatorToken.kind;
		if (kind === ts.SyntaxKind.PlusToken) {
			return this.append_concat(values, name, expression);
		}
		if (kind !== ts.SyntaxKind.AmpersandAmpersandToken && kind !== ts.SyntaxKind.BarBarToken) {
			if (kind !== ts.SyntaxKind.QuestionQuestionToken && kind !== ts.SyntaxKind.CommaToken) {
				return false;
			}
		}
		return this.append_branch(values, name, expression.left, expression.right);
	}

	/** Responsibilities: _identifier static value resolution_. **/
	private append_identifier(values: Map<string, string>, name: string, current: ts.Identifier): boolean {
		const value = values.get(current.text);
		if (value === undefined || values.has(name)) {
			return false;
		}
		values.set(name, value);
		return true;
	}

	/** Responsibilities: _static literal resolution_. **/
	public literal(values: ReadonlyMap<string, string>, expression: ts.Expression): string {
		const current = this.expression_aliases.unwrapped(expression);
		if (this.literal_kinds.has(current.kind)) {
			return current.getText().replace(/^['"`]|['"`]$/g, "");
		}
		if (!ts.isTemplateExpression(current)) {
			return "";
		}
		return this.template_value(values, current);
	}

	/** Responsibilities: _static expression value collection_. **/
	public append(values: Map<string, string>, name: string, initializer: ts.Expression): boolean {
		const current = this.expression_aliases.unwrapped(initializer);
		if (this.append_literal(values, name, current)) {
			return true;
		}
		if (ts.isConditionalExpression(current)) {
			return this.append_branch(values, name, current.whenTrue, current.whenFalse);
		}
		if (ts.isBinaryExpression(current)) {
			return this.append_binary(values, name, current);
		}
		if (!ts.isIdentifier(current)) {
			return false;
		}
		return this.append_identifier(values, name, current);
	}
}
