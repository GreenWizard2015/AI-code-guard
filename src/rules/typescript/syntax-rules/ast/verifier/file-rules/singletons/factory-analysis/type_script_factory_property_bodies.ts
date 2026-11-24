import type { ExpressionNamesContract } from "src/runtime_protocols";
import type { TypeScriptFactoryObjectPropertiesContract } from "src/typescript_runtime_protocols";
import ts from "typescript";

/** Responsibilities: _factory property name_, _property callable bodies_. **/
export class TypeScriptFactoryPropertyBodies {
	private readonly _expression: ts.Expression;
	private readonly _expression_names: ExpressionNamesContract;
	private readonly _object_sources: Map<string, ts.ObjectLiteralExpression>;
	private readonly _properties: TypeScriptFactoryObjectPropertiesContract;

	/** Responsibilities: _object property callables_. **/
	private append_receiver_bodies(receiver: ts.Expression, bodies: ts.FunctionLikeDeclarationBase[]): void {
		const source = this._expression_names.unwrap_transparent_expression(receiver);
		if (!ts.isIdentifier(source)) {
			return;
		}
		const object = this._object_sources.get(source.text);
		if (object === undefined) {
			return;
		}
		const property_context = this._properties.property_context(object, this.property_name());
		for (const body of property_context.expressions().values()) {
			bodies.push(body);
		}
	}

	/** Responsibilities: _property access routing_. **/
	private append_bodies(bodies: ts.FunctionLikeDeclarationBase[]): void {
		if (ts.isPropertyAccessExpression(this._expression)) {
			this.append_receiver_bodies(this._expression.expression, bodies);
			return;
		}
		if (ts.isElementAccessExpression(this._expression)) {
			this.append_receiver_bodies(this._expression.expression, bodies);
		}
	}

	/** Responsibilities: _factory property body context_. **/
	public constructor(
		expression: ts.Expression,
		expression_names: ExpressionNamesContract,
		object_sources: Map<string, ts.ObjectLiteralExpression>,
		properties: TypeScriptFactoryObjectPropertiesContract,
	) {
		this._expression = expression;
		this._expression_names = expression_names;
		this._object_sources = object_sources;
		this._properties = properties;
	}

	/** Responsibilities: _factory property name_. **/
	public property_name(): string {
		if (ts.isPropertyAccessExpression(this._expression)) {
			return this._expression.name.text;
		}
		if (!ts.isElementAccessExpression(this._expression)) {
			return "";
		}
		const argument = this._expression.argumentExpression;
		if (argument === undefined) {
			return "";
		}
		return argument.getText().replace(/^['"`]|['"`]$/g, "");
	}

	/** Responsibilities: _factory property callable bodies_. **/
	public bodies(): readonly ts.FunctionLikeDeclarationBase[] {
		const bodies: ts.FunctionLikeDeclarationBase[] = [];
		this.append_bodies(bodies);
		return bodies;
	}
}
