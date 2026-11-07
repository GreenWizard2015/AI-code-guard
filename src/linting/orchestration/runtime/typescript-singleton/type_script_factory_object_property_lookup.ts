import type { ExpressionNamesContract } from "src/runtime_protocols";
import type { TypeScriptFactoryObjectPropertyLookupContract } from "src/typescript_runtime_protocols";
import ts from "typescript";

/** Responsibilities: _factory property source_, _factory callable expression resolution_. **/
export class TypeScriptFactoryObjectPropertyLookup implements TypeScriptFactoryObjectPropertyLookupContract {
	private readonly _initializer: ts.ObjectLiteralExpression;
	private readonly _property_name: string;
	private readonly _object_sources: Map<string, ts.ObjectLiteralExpression>;
	private readonly _expression_names: ExpressionNamesContract;
	private readonly _collected_expressions: Map<string, ts.FunctionLikeDeclarationBase>;

	/** Responsibilities: _direct property source_. **/
	private direct_source(property: ts.ObjectLiteralElementLike): string {
		if (property.name === undefined) {
			return "";
		}
		const name = this._expression_names.static_property_name(property.name);
		if (name !== this._property_name) {
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

	/** Responsibilities: _factory callable expression recording_. **/
	private append_callable(callable_initializer: ts.Expression): void {
		const unwrapped_expression = this._expression_names.unwrap_transparent_expression(callable_initializer);
		let callable: ts.FunctionLikeDeclarationBase | undefined;
		if (ts.isArrowFunction(unwrapped_expression)) {
			callable = unwrapped_expression;
		} else if (ts.isFunctionExpression(unwrapped_expression)) {
			callable = unwrapped_expression;
		}
		if (callable !== undefined) {
			this._collected_expressions.set(this._property_name, callable);
		}
	}

	/** Responsibilities: _direct factory expression_. **/
	private direct_expression(property: ts.ObjectLiteralElementLike): void {
		if (property.name === undefined) {
			return;
		}
		if (!ts.isPropertyAssignment(property)) {
			return;
		}
		const name = this._expression_names.static_property_name(property.name);
		if (name === this._property_name) {
			this.append_callable(property.initializer);
		}
	}

	/** Responsibilities: _spread property source_. **/
	private spread_source(spread_value: ts.Expression): string {
		let source = this._expression_names.unwrap_transparent_expression(spread_value);
		if (ts.isIdentifier(source)) {
			const object_source = this._object_sources.get(source.text);
			if (object_source === undefined) {
				return "";
			}
			source = object_source;
		}
		if (!ts.isObjectLiteralExpression(source)) {
			return "";
		}
		const nested_lookup = new TypeScriptFactoryObjectPropertyLookup(
			source,
			this._property_name,
			this._object_sources,
			this._expression_names,
			new Map<string, ts.FunctionLikeDeclarationBase>(),
		);
		return nested_lookup.source();
	}

	/** Responsibilities: _factory expression spread collection_. **/
	private spread_expressions(spread_value: ts.Expression): void {
		const source = this._expression_names.unwrap_transparent_expression(spread_value);
		if (ts.isIdentifier(source)) {
			const object_source = this._object_sources.get(source.text);
			if (object_source === undefined) {
				return;
			}
			this.append_lookup(object_source);
			return;
		}
		if (ts.isObjectLiteralExpression(source)) {
			this.append_lookup(source);
		}
	}

	/** Responsibilities: _nested factory expression resolution_. **/
	private append_lookup(initializer: ts.ObjectLiteralExpression): void {
		const nested_lookup = new TypeScriptFactoryObjectPropertyLookup(
			initializer,
			this._property_name,
			this._object_sources,
			this._expression_names,
			this._collected_expressions,
		);
		nested_lookup.append_expressions();
	}

	/** Responsibilities: _factory expression collection_. **/
	private append_expressions(): void {
		for (let index = this._initializer.properties.length - 1; index >= 0; index -= 1) {
			if (this._collected_expressions.has(this._property_name)) {
				return;
			}
			const property = this._initializer.properties[index];
			if (property === undefined) {
				continue;
			}
			if (ts.isSpreadAssignment(property)) {
				this.spread_expressions(property.expression);
				continue;
			}
			this.direct_expression(property);
		}
	}

	/** Responsibilities: _factory object property context_. **/
	public constructor(
		initializer: ts.ObjectLiteralExpression,
		property_name: string,
		object_sources: Map<string, ts.ObjectLiteralExpression>,
		expression_names: ExpressionNamesContract,
		collected_expressions: Map<string, ts.FunctionLikeDeclarationBase>,
	) {
		this._initializer = initializer;
		this._property_name = property_name;
		this._object_sources = object_sources;
		this._expression_names = expression_names;
		this._collected_expressions = collected_expressions;
	}

	/** Responsibilities: _factory property callable collection_. **/
	public expressions(): ReadonlyMap<string, ts.FunctionLikeDeclarationBase> {
		this.append_expressions();
		return this._collected_expressions;
	}

	/** Responsibilities: _factory property source_. **/
	public source(): string {
		for (let index = this._initializer.properties.length - 1; index >= 0; index -= 1) {
			const property = this._initializer.properties[index];
			if (property === undefined) {
				continue;
			}
			let source = "";
			if (ts.isSpreadAssignment(property)) {
				source = this.spread_source(property.expression);
			} else {
				source = this.direct_source(property);
			}
			if (source !== "") {
				return source;
			}
		}
		return "";
	}
}
