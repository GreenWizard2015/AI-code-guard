import ts from "typescript";
import type { TypeScriptFactoryArrayAliasesProtocol } from "src/protocols";
import { TypeScriptFactoryNestedObjectExpressions } from "src/bridge/ts/runner/orchestration/runtime/typescript-singleton/factory-nested-object-expressions";
import { TypeScriptExpressionNames } from "src/typescript-aliases/typescript-expression-names";

/** Responsibilities: _resolution factory object properties_. **/
export class TypeScriptFactoryObjectProperties {
	private readonly expression_names = new TypeScriptExpressionNames();
	private readonly object_sources: Map<string, ts.ObjectLiteralExpression>;
	private readonly nested_expressions: TypeScriptFactoryNestedObjectExpressions;

	/** Responsibilities: _direct property source_. **/
	private direct_source(property: ts.ObjectLiteralElementLike, property_name: string): string {
		if (this.property_key(property) !== property_name) {
			return "";
		}
		if (ts.isShorthandPropertyAssignment(property)) {
			return property.name.text;
		}
		if (ts.isPropertyAssignment(property) && ts.isIdentifier(property.initializer)) {
			return property.initializer.text;
		}
		return "";
	}

	/** Responsibilities: _direct factory expression_. **/
	private direct_expression(
		property: ts.ObjectLiteralElementLike,
		property_name: string,
		expressions: Map<string, ts.FunctionLikeDeclarationBase>,
	): void {
		if (this.property_key(property) !== property_name || !ts.isPropertyAssignment(property)) {
			return;
		}
		const expression = this.expression_names.unwrap_transparent_expression(property.initializer);
		if (ts.isArrowFunction(expression) || ts.isFunctionExpression(expression)) {
			expressions.set(property_name, expression);
		}
	}

	/** Responsibilities: _spread property source_. **/
	private spread_source(expression: ts.Expression, property_name: string): string {
		let source = this.expression_names.unwrap_transparent_expression(expression);
		if (ts.isIdentifier(source)) {
			const object_source = this.object_sources.get(source.text);
			if (object_source === undefined) {
				return "";
			}
			source = object_source;
		}
		if (!ts.isObjectLiteralExpression(source)) {
			return "";
		}
		return this.source(source, property_name);
	}

	/** Responsibilities: _factory property source resolution_. **/
	private resolve_source(initializer: ts.ObjectLiteralExpression, property_name: string): string {
		for (let index = initializer.properties.length - 1; index >= 0; index -= 1) {
			const property = initializer.properties[index];
			let source = "";
			if (ts.isSpreadAssignment(property)) {
				source = this.spread_source(property.expression, property_name);
			} else {
				source = this.direct_source(property, property_name);
			}
			if (source !== "") {
				return source;
			}
		}
		return "";
	}

	/** Responsibilities: _factory expression collection_. **/
	private spread_expressions(
		expression: ts.Expression,
		property_name: string,
		expressions: Map<string, ts.FunctionLikeDeclarationBase>,
	): void {
		const source = this.expression_names.unwrap_transparent_expression(expression);
		if (ts.isIdentifier(source)) {
			const object_source = this.object_sources.get(source.text);
			if (object_source !== undefined) {
				this.resolve_expression(object_source, property_name, expressions);
			}
		}
		if (ts.isObjectLiteralExpression(source)) {
			this.resolve_expression(source, property_name, expressions);
		}
	}

	/** Responsibilities: _factory expression collection_. **/
	private resolve_expression(
		initializer: ts.ObjectLiteralExpression,
		property_name: string,
		expressions: Map<string, ts.FunctionLikeDeclarationBase>,
	): void {
		for (let index = initializer.properties.length - 1; index >= 0; index -= 1) {
			if (expressions.has(property_name)) {
				return;
			}
			const property = initializer.properties[index];
			if (ts.isSpreadAssignment(property)) {
				this.spread_expressions(property.expression, property_name, expressions);
				continue;
			}
			this.direct_expression(property, property_name, expressions);
		}
	}

	/** Responsibilities: _initialization factory object properties_. **/
	public constructor(
		object_sources: Map<string, ts.ObjectLiteralExpression>,
		array_aliases: TypeScriptFactoryArrayAliasesProtocol,
	) {
		this.object_sources = object_sources;
		this.nested_expressions = new TypeScriptFactoryNestedObjectExpressions(object_sources, this, array_aliases);
	}

	/** Responsibilities: _factory expression source_. **/
	public expressions(
		initializer: ts.ObjectLiteralExpression,
		property_name: string,
	): ReadonlyMap<string, ts.FunctionLikeDeclarationBase> {
		const expressions = new Map<string, ts.FunctionLikeDeclarationBase>();
		this.resolve_expression(initializer, property_name, expressions);
		return expressions;
	}

	/** Responsibilities: _static property name_. **/
	public property_key(property: ts.ObjectLiteralElementLike): string {
		if (property.name === undefined) {
			return "";
		}
		return this.expression_names.static_property_name(property.name);
	}

	/** Responsibilities: _factory property sources_. **/
	public sources(
		initializer: ts.ObjectLiteralExpression,
		property_names: readonly string[],
	): ReadonlyMap<string, string> {
		const sources = new Map<string, string>();
		for (const property_name of property_names) {
			sources.set(property_name, this.resolve_source(initializer, property_name));
		}
		return sources;
	}

	/** Responsibilities: _factory property source_. **/
	public source(initializer: ts.ObjectLiteralExpression, property_name: string): string {
		const sources = this.sources(initializer, [property_name]);
		const source = sources.get(property_name);
		if (source === undefined) {
			return "";
		}
		return source;
	}

	/** Responsibilities: _binding expression sources_. **/
	public binding_expressions(
		initializer: ts.ObjectLiteralExpression,
		binding: ts.ObjectBindingPattern,
		name: string,
	): ReadonlyMap<string, ts.FunctionLikeDeclarationBase> {
		const expressions = new Map<string, ts.FunctionLikeDeclarationBase>();
		for (const expression of this.nested_expressions.expressions(initializer, binding, name).values()) {
			expressions.set(name, expression);
		}
		return expressions;
	}
}
