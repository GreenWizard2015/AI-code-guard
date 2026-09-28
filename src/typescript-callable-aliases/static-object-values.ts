import ts from 'typescript';
import { TypeScriptExpressionAliases } from 'src/typescript-aliases/typescript-expression-aliases';
import { static_property_name } from 'functions';

/** Responsibilities: _static object value collection_. **/
export class TypeScriptStaticObjectValues {
	private readonly expression_aliases = new TypeScriptExpressionAliases('');
	private readonly literal_kinds = new Set([
		ts.SyntaxKind.StringLiteral,
		ts.SyntaxKind.NoSubstitutionTemplateLiteral,
		ts.SyntaxKind.NumericLiteral,
	]);
	private readonly values: Map<string, string>;
	private readonly objects: Map<string, ts.ObjectLiteralExpression>;

	/** Responsibilities: _computed object property name_. **/
	private computed_property_name(node: ts.ComputedPropertyName): string {
		const static_name = static_property_name(node);
		if (static_name !== '') {
			return static_name;
		}
		const current = this.expression_aliases.unwrapped(node.expression);
		if (!ts.isIdentifier(current)) {
			return '';
		}
		const value = this.values.get(current.text);
		if (value === undefined) {
			return '';
		}
		return value;
	}

	/** Responsibilities: _named object property addition_. **/
	private append_named_property(
		property: ts.ObjectLiteralElementLike,
		source_name: string,
		append_value: (value: ts.Expression) => boolean
	): boolean {
		if (ts.isPropertyAssignment(property)) {
			if (this.property_name(property.name) !== source_name) {
				return false;
			}
			return append_value(property.initializer);
		}
		if (ts.isShorthandPropertyAssignment(property)) {
			if (this.property_name(property.name) === source_name) {
				return append_value(property.name);
			}
		}
		return false;
	}

	/** Responsibilities: _spread object property value_. **/
	private spread_property_value(
		property: ts.SpreadAssignment,
		source_name: string,
		seen: Set<ts.ObjectLiteralExpression>,
		append_value: (value: ts.Expression) => boolean
	): boolean {
		const current = this.expression_aliases.unwrapped(property.expression);
		if (ts.isObjectLiteralExpression(current)) {
			return this.append_property_value(current, source_name, seen, append_value);
		}
		if (!ts.isIdentifier(current)) {
			return false;
		}
		const object = this.objects.get(current.text);
		if (object === undefined) {
			return false;
		}
		return this.append_property_value(object, source_name, seen, append_value);
	}

	/** Responsibilities: _literal object source_. **/
	private append_literal_object(name: string, value: ts.ObjectLiteralExpression): boolean {
		if (this.objects.has(name)) {
			return false;
		}
		this.objects.set(name, value);
		return true;
	}

	/** Responsibilities: _aliased object source_. **/
	private append_alias_object(name: string, value: ts.Identifier): boolean {
		const object = this.objects.get(value.text);
		if (object === undefined) {
			return false;
		}
		if (this.objects.has(name)) {
			return false;
		}
		this.objects.set(name, object);
		return true;
	}

	/** Responsibilities: _object property addition_. **/
	private append_property(
		property: ts.ObjectLiteralElementLike,
		source_name: string,
		seen: Set<ts.ObjectLiteralExpression>,
		append_value: (value: ts.Expression) => boolean
	): boolean {
		if (this.append_named_property(property, source_name, append_value)) {
			return true;
		}
		if (!ts.isSpreadAssignment(property)) {
			return false;
		}
		return this.spread_property_value(property, source_name, seen, append_value);
	}

	/** Responsibilities: _literal object value addition_. **/
	private append_literal(name: string, current: ts.Expression): boolean {
		if (!this.literal_kinds.has(current.kind)) {
			return false;
		}
		if (this.values.has(name)) {
			return false;
		}
		this.values.set(name, current.getText().replace(/^['"`]|['"`]$/g, ''));
		return true;
	}

	/** Responsibilities: _aliased object value addition_. **/
	private append_alias(name: string, current: ts.Expression): boolean {
		if (!ts.isIdentifier(current)) {
			return false;
		}
		if (this.values.has(name)) {
			return false;
		}
		const value = this.values.get(current.text);
		if (value === undefined) {
			return false;
		}
		this.values.set(name, value);
		return true;
	}

	/** Responsibilities: _object value state_. **/
	public constructor(values: Map<string, string>, objects: Map<string, ts.ObjectLiteralExpression>) {
		this.values = values;
		this.objects = objects;
	}

	/** Responsibilities: _object property name_. **/
	public property_name(node: ts.Node): string {
		if (ts.isComputedPropertyName(node)) {
			return this.computed_property_name(node);
		}
		return static_property_name(node);
	}

	/** Responsibilities: _object property value addition_. **/
	public append_property_value(
		initializer: ts.ObjectLiteralExpression,
		source_name: string,
		seen: Set<ts.ObjectLiteralExpression>,
		append_value: (value: ts.Expression) => boolean
	): boolean {
		if (seen.has(initializer)) {
			return false;
		}
		seen.add(initializer);
		for (let index = initializer.properties.length - 1; index >= 0; index -= 1) {
			const property = initializer.properties[index];
			if (property === undefined) {
				continue;
			}
			if (this.append_property(property, source_name, seen, append_value)) {
				return true;
			}
		}
		return false;
	}

	/** Responsibilities: _object value addition_. **/
	public append_value(name: string, current: ts.Expression): boolean {
		if (this.append_literal(name, current)) {
			return true;
		}
		return this.append_alias(name, current);
	}

	/** Responsibilities: _object alias addition_. **/
	public append_object(name: string, current: ts.Expression): boolean {
		const value = this.expression_aliases.unwrapped(current);
		if (ts.isObjectLiteralExpression(value)) {
			return this.append_literal_object(name, value);
		}
		if (!ts.isIdentifier(value)) {
			return false;
		}
		return this.append_alias_object(name, value);
	}

	/** Responsibilities: _object property value resolution_. **/
	public property_value(object: ts.ObjectLiteralExpression, source_name: string): string {
		let result = '';
		this.append_property_value(object, source_name, new Set(), current => {
			const value = this.expression_aliases.unwrapped(current);
			if (this.literal_kinds.has(value.kind)) {
				result = value.getText().replace(/^['"`]|['"`]$/g, '');
				return result !== '';
			}
			if (ts.isIdentifier(value)) {
				const aliased = this.values.get(value.text);
				if (aliased !== undefined) {
					result = aliased;
					return true;
				}
			}
			return false;
		});
		return result;
	}
}
