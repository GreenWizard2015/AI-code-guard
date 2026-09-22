import ts from 'typescript';

/** Responsibilities: _extraction names pointless expression_. **/
export class PointlessExpression {
	private readonly single_argument = 1;

	/** Responsibilities: _resolution first binding name_. **/
	private first_binding_name(name: ts.BindingPattern): string {
		const first = name.elements[0];
		if (!first) {
			return '';
		}
		if (!('name' in first)) {
			return '';
		}
		return this.binding_name(first.name);
	}

	/** Responsibilities: _argument names extraction _. **/
	private constructor_argument_names(expression: ts.NewExpression): string[] {
if (!expression.arguments || expression.arguments.length !== this.single_argument) {
			return [];
		}
		const argument = expression.arguments[0];
		if (ts.isIdentifier(argument)) {
			return [argument.text];
		}
		return [];
	}

	/** Responsibilities: _object shorthand names extraction_. **/
	private object_shorthand_names(expression: ts.Expression): string[] {
if (!ts.isObjectLiteralExpression(expression) || expression.properties.length !== 1) {
			return [];
		}
		const property = expression.properties[0];
		if (ts.isShorthandPropertyAssignment(property)) {
			return [property.name.text];
		}
		return [];
	}

	/** Responsibilities: _binding name resolution_. **/
	public binding_name(name: ts.BindingName): string {
		if (ts.isIdentifier(name)) {
			return name.text;
		}
		return this.first_binding_name(name);
	}

	/** Responsibilities: _extraction names output statement_. **/
	public returned_names_from(statement: ts.Statement): string[] {
		if (!ts.isReturnStatement(statement) || !statement.expression) {
			return [];
		}
		const expression = statement.expression;
		if (ts.isNewExpression(expression)) {
			return this.constructor_argument_names(expression);
		}
		if (ts.isIdentifier(expression)) {
			return [expression.text];
		}
		return this.object_shorthand_names(expression);
	}
}
