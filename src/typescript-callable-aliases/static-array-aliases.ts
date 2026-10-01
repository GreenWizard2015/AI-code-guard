import ts from "typescript";
import { TypeScriptExpressionAliases } from "src/typescript-aliases/typescript-expression-aliases";

/** Responsibilities: _static array alias collection_. **/
export class TypeScriptStaticArrayAliases {
	private readonly expression_aliases = new TypeScriptExpressionAliases("");
	private readonly static_key_kinds = new Set([
		ts.SyntaxKind.StringLiteral,
		ts.SyntaxKind.NoSubstitutionTemplateLiteral,
		ts.SyntaxKind.NumericLiteral,
	]);
	private readonly values: Map<string, string>;
	private readonly arrays: Map<string, readonly ts.Expression[]>;

	/** Responsibilities: _literal array value_. **/
	private append_literal(values: Map<string, string>, name: string, current: ts.Expression): boolean {
		const value = current.getText().replace(/^['"`]|['"`]$/g, "");
		if (values.has(name) || value.length === 0) {
			return false;
		}
		values.set(name, value);
		return true;
	}

	/** Responsibilities: _aliased array value_. **/
	private append_alias(values: Map<string, string>, name: string, current: ts.Identifier): boolean {
		const value = values.get(current.text);
		if (value === undefined || values.has(name)) {
			return false;
		}
		values.set(name, value);
		return true;
	}

	/** Responsibilities: _array value addition_. **/
	private append_value(name: string, initializer: ts.Expression): boolean {
		const current = this.expression_aliases.unwrapped(initializer);
		if (this.static_key_kinds.has(current.kind)) {
			return this.append_literal(this.values, name, current);
		}
		if (!ts.isIdentifier(current)) {
			return false;
		}
		return this.append_alias(this.values, name, current);
	}

	/** Responsibilities: _array binding element_. **/
	private append_array_element(element: ts.BindingElement, value: ts.Expression): boolean {
		if (!ts.isIdentifier(element.name)) {
			return false;
		}
		return this.append_value(element.name.text, value);
	}

	/** Responsibilities: _array binding values_. **/
	private append_array_elements(binding: ts.ArrayBindingPattern, initializer: readonly ts.Expression[]): boolean {
		let changed = false;
		for (const [index, value] of initializer.entries()) {
			const element = binding.elements[index];
			if (element === undefined || !ts.isBindingElement(element)) {
				continue;
			}
			if (this.append_array_element(element, value)) {
				changed = true;
			}
		}
		return changed;
	}

	/** Responsibilities: _array rest aliases_. **/
	private append_array_rest(binding: ts.ArrayBindingPattern, initializer: readonly ts.Expression[]): boolean {
		let changed = false;
		for (const [index, element] of binding.elements.entries()) {
			if (!ts.isBindingElement(element)) {
				continue;
			}
			if (!element.dotDotDotToken) {
				continue;
			}
			if (!ts.isIdentifier(element.name) || this.arrays.has(element.name.text)) {
				continue;
			}
			this.arrays.set(element.name.text, initializer.slice(index));
			changed = true;
		}
		return changed;
	}

	/** Responsibilities: _array spread elements_. **/
	private append_spread_elements(values: ts.Expression[], element: ts.SpreadElement): void {
		const current = this.expression_aliases.unwrapped(element.expression);
		if (ts.isArrayLiteralExpression(current)) {
			values.push(...this.normalized_elements(current.elements));
			return;
		}
		if (!ts.isIdentifier(current)) {
			return;
		}
		const array = this.arrays.get(current.text);
		if (array !== undefined) {
			values.push(...array);
		}
	}

	/** Responsibilities: _array element collection_. **/
	private normalized_elements(initializer: readonly ts.Expression[]): ts.Expression[] {
		const values: ts.Expression[] = [];
		for (const element of initializer) {
			if (ts.isSpreadElement(element)) {
				this.append_spread_elements(values, element);
				continue;
			}
			values.push(element);
		}
		return values;
	}

	/** Responsibilities: _literal array source_. **/
	private append_literal_source(name: string, value: ts.ArrayLiteralExpression): boolean {
		if (this.arrays.has(name)) {
			return false;
		}
		this.arrays.set(name, this.normalized_elements(value.elements));
		return true;
	}

	/** Responsibilities: _aliased array source_. **/
	private append_alias_source(name: string, value: ts.Identifier): boolean {
		const array = this.arrays.get(value.text);
		if (array === undefined || this.arrays.has(name)) {
			return false;
		}
		this.arrays.set(name, array);
		return true;
	}

	/** Responsibilities: _array binding values_. **/
	private append_array_values(binding: ts.ArrayBindingPattern, initializer: readonly ts.Expression[]): boolean {
		let changed = this.append_array_rest(binding, initializer);
		if (this.append_array_elements(binding, initializer)) {
			changed = true;
		}
		return changed;
	}

	/** Responsibilities: _array alias declaration_. **/
	private append_array_alias(binding: ts.ArrayBindingPattern, initializer: ts.Identifier): boolean {
		const array = this.arrays.get(initializer.text);
		if (array === undefined) {
			return false;
		}
		return this.append_array_values(binding, array);
	}

	/** Responsibilities: _array alias state_. **/
	public constructor(values: Map<string, string>, arrays: Map<string, readonly ts.Expression[]>) {
		this.values = values;
		this.arrays = arrays;
	}

	/** Responsibilities: _array source collection_. **/
	public append_source(node: ts.VariableDeclaration): boolean {
		if (!ts.isIdentifier(node.name) || node.initializer === undefined) {
			return false;
		}
		const current = this.expression_aliases.unwrapped(node.initializer);
		if (ts.isArrayLiteralExpression(current)) {
			return this.append_literal_source(node.name.text, current);
		}
		if (!ts.isIdentifier(current)) {
			return false;
		}
		return this.append_alias_source(node.name.text, current);
	}

	/** Responsibilities: _array declaration collection_. **/
	public append_declaration(node: ts.VariableDeclaration): boolean {
		if (!ts.isArrayBindingPattern(node.name) || node.initializer === undefined) {
			return false;
		}
		const initializer = this.expression_aliases.unwrapped(node.initializer);
		if (ts.isArrayLiteralExpression(initializer)) {
			return this.append_array_values(node.name, this.normalized_elements(initializer.elements));
		}
		if (!ts.isIdentifier(initializer)) {
			return false;
		}
		return this.append_array_alias(node.name, initializer);
	}
}
