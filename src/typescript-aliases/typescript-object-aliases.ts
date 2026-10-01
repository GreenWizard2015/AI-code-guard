import ts from "typescript";
import { TypeScriptExpressionNames } from "src/typescript-aliases/typescript-expression-names";

/** Responsibilities: _TypeScript object alias storage_. **/
export class TypeScriptObjectAliases {
	private readonly expression_names = new TypeScriptExpressionNames();
	private readonly aliases = new Map<string, ts.ObjectLiteralExpression>();

	/** Responsibilities: _named property value addition_. **/
	private append_named_value(
		property: ts.ObjectLiteralElementLike,
		property_name: string,
		values: ts.Expression[],
	): boolean {
		if (ts.isPropertyAssignment(property)) {
			if (this.expression_names.static_property_name(property.name) === property_name) {
				values.push(property.initializer);
			}
			return true;
		}
		if (!ts.isShorthandPropertyAssignment(property)) {
			return false;
		}
		if (this.expression_names.static_property_name(property.name) === property_name) {
			values.push(property.name);
		}
		return true;
	}

	/** Responsibilities: _spread property value addition_. **/
	private append_spread_value(
		property: ts.ObjectLiteralElementLike,
		property_name: string,
		values: ts.Expression[],
		seen: Set<ts.ObjectLiteralExpression>,
	): void {
		if (!ts.isSpreadAssignment(property)) {
			return;
		}
		const source = this.value(property.expression);
		if (ts.isObjectLiteralExpression(source)) {
			this.append_property_values(source, property_name, values, seen);
		}
	}

	/** Responsibilities: _object property value addition_. **/
	private append_property_value(
		property: ts.ObjectLiteralElementLike,
		property_name: string,
		values: ts.Expression[],
		seen: Set<ts.ObjectLiteralExpression>,
	): void {
		if (this.append_named_value(property, property_name, values)) {
			return;
		}
		this.append_spread_value(property, property_name, values, seen);
	}

	/** Responsibilities: _object property values collection_. **/
	private append_property_values(
		object: ts.ObjectLiteralExpression,
		property_name: string,
		values: ts.Expression[],
		seen: Set<ts.ObjectLiteralExpression>,
	): void {
		if (seen.has(object)) {
			return;
		}
		seen.add(object);
		for (const property of object.properties) {
			this.append_property_value(property, property_name, values, seen);
		}
	}

	/** Responsibilities: _object alias declaration addition_. **/
	private append_value(name: string, initializer: ts.Expression): boolean {
		const value = this.value(initializer);
		if (!ts.isObjectLiteralExpression(value) || this.aliases.has(name)) {
			return false;
		}
		this.aliases.set(name, value);
		return true;
	}

	/** Responsibilities: _object variable addition_. **/
	private append_variable(node: ts.VariableDeclaration): boolean {
		if (!ts.isIdentifier(node.name)) {
			return false;
		}
		if (node.initializer === undefined) {
			return false;
		}
		return this.append_value(node.name.text, node.initializer);
	}

	/** Responsibilities: _object assignment addition_. **/
	private append_assignment(node: ts.BinaryExpression): boolean {
		if (node.operatorToken.kind !== ts.SyntaxKind.EqualsToken) {
			return false;
		}
		if (!ts.isIdentifier(node.left)) {
			return false;
		}
		return this.append_value(node.left.text, node.right);
	}

	/** Responsibilities: _object alias declaration addition_. **/
	private append(node: ts.Node): boolean {
		if (ts.isVariableDeclaration(node)) {
			return this.append_variable(node);
		}
		if (ts.isBinaryExpression(node)) {
			return this.append_assignment(node);
		}
		return false;
	}

	/** Responsibilities: _object alias declaration collection_. **/
	private collect_declarations(node: ts.Node, root: ts.Node, declarations: ts.Node[]): void {
		if (node !== root) {
			if (ts.isFunctionLike(node)) {
				return;
			}
		}
		if (ts.isVariableDeclaration(node)) {
			declarations.push(node);
		}
		if (ts.isBinaryExpression(node)) {
			declarations.push(node);
		}
		node.forEachChild((child) => this.collect_declarations(child, root, declarations));
	}

	/** Responsibilities: _object aliases collection_. **/
	public collect(scope: ts.Node): void {
		const declarations: ts.Node[] = [];
		this.collect_declarations(scope, scope, declarations);
		let changed = true;
		while (changed) {
			changed = false;
			for (const declaration of declarations) {
				if (this.append(declaration)) {
					changed = true;
				}
			}
		}
	}

	/** Responsibilities: _object alias value resolution_. **/
	public value(expression: ts.Expression): ts.Expression {
		let current = expression;
		const seen = new Set<string>();
		while (ts.isParenthesizedExpression(current)) {
			current = current.expression;
		}
		while (ts.isIdentifier(current) && !seen.has(current.text)) {
			const object_value = this.aliases.get(current.text);
			if (object_value === undefined) {
				break;
			}
			seen.add(current.text);
			current = object_value;
		}
		return current;
	}

	/** Responsibilities: _object property values resolution_. **/
	public property_values(expression: ts.Expression, property_name: string): readonly ts.Expression[] {
		const object = this.value(expression);
		if (!ts.isObjectLiteralExpression(object)) {
			return [];
		}
		const values: ts.Expression[] = [];
		this.append_property_values(object, property_name, values, new Set<ts.ObjectLiteralExpression>());
		return values;
	}
}
