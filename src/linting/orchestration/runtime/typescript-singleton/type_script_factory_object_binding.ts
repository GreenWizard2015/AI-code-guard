import type { TypeScriptFactoryObjectBindingOptions } from "src/contracts/protocols/lint_runtime_protocols";
import type { ExpressionNamesContract } from "src/runtime_protocols";
import type { TypeScriptFactoryObjectPropertiesContract } from "src/typescript_runtime_protocols";
import ts from "typescript";

/** Responsibilities: _factory binding source_, _factory binding expressions_. **/
export class TypeScriptFactoryObjectBinding {
	private readonly _binding: ts.ObjectBindingPattern;
	private readonly _initializer: ts.Expression;
	private readonly _name: string;
	private readonly _expression_names: ExpressionNamesContract;
	private readonly _object_sources: Map<string, ts.ObjectLiteralExpression>;
	private readonly _properties: TypeScriptFactoryObjectPropertiesContract;

	/** Responsibilities: _matching binding source_. **/
	private literal_source(initializer: ts.ObjectLiteralExpression): string {
		for (const element of this._binding.elements) {
			if (!ts.isBindingElement(element)) {
				continue;
			}
			if (!ts.isIdentifier(element.name)) {
				continue;
			}
			if (element.name.text !== this._name) {
				continue;
			}
			const property_name = this._expression_names.static_binding_name(element);
			const property_context = this._properties.property_context(initializer, property_name);
			return property_context.source();
		}
		return "";
	}

	/** Responsibilities: _factory object binding context_. **/
	public constructor(options: TypeScriptFactoryObjectBindingOptions) {
		this._binding = options.binding;
		this._initializer = options.initializer;
		this._name = options.name;
		this._expression_names = options.expression_names;
		this._object_sources = options.object_sources;
		this._properties = options.properties;
	}

	/** Responsibilities: _object binding source_. **/
	public source(): string {
		const expression = this._expression_names.unwrap_transparent_expression(this._initializer);
		if (ts.isIdentifier(expression)) {
			const source = this._object_sources.get(expression.text);
			if (source === undefined) {
				return "";
			}
			return this.literal_source(source);
		}
		if (ts.isObjectLiteralExpression(expression)) {
			return this.literal_source(expression);
		}
		return "";
	}

	/** Responsibilities: _object binding expression accumulation_. **/
	public append_expressions(expressions: Map<string, ts.FunctionLikeDeclarationBase>): void {
		let source = this._expression_names.unwrap_transparent_expression(this._initializer);
		if (ts.isIdentifier(source)) {
			const object_source = this._object_sources.get(source.text);
			if (object_source === undefined) {
				return;
			}
			source = object_source;
		}
		if (!ts.isObjectLiteralExpression(source)) {
			return;
		}
		for (const [alias_name, expression] of this._properties.binding_expressions(source, this._binding, this._name)) {
			expressions.set(alias_name, expression);
		}
	}
}
