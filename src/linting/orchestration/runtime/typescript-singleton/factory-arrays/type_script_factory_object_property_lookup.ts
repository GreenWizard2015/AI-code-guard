import type { CallableExpressionVisitor } from "src/analysis_types";
import type {
	FactoryObjectSourcesContract,
	TypeScriptFactoryObjectPropertyLookupContract,
} from "src/contracts/protocols/lint_runtime_protocols";
import type { ExpressionNamesContract } from "src/runtime_protocols";
import ts from "typescript";

/** Responsibilities: _object property source lookup_, _spread property traversal_. **/
export class TypeScriptFactoryObjectPropertyLookup implements TypeScriptFactoryObjectPropertyLookupContract {
	private readonly _expression_names: ExpressionNamesContract;
	private readonly _initializer: ts.ObjectLiteralExpression;
	private readonly _object_sources: FactoryObjectSourcesContract;
	private readonly _property_name: string;

	/** Responsibilities: _nested object property lookup_. **/
	private object_lookup(initializer: ts.ObjectLiteralExpression): TypeScriptFactoryObjectPropertyLookupContract {
		return new TypeScriptFactoryObjectPropertyLookup(
			initializer,
			this._property_name,
			this._expression_names,
			this._object_sources,
		);
	}

	/** Responsibilities: _source property lookup_. **/
	private source_property(property: ts.ObjectLiteralElementLike): string {
		if (ts.isSpreadAssignment(property)) {
			return this.spread_source(property.expression);
		}
		if (property.name === undefined) {
			return "";
		}
		if (this._expression_names.static_property_name(property.name) !== this._property_name) {
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

	/** Responsibilities: _spread property source_. **/
	private spread_source(expression: ts.Expression): string {
		let result = "";
		this._object_sources.append(expression, (initializer) => {
			result = this.object_lookup(initializer).property_source();
		});
		return result;
	}

	/** Responsibilities: _matching property value traversal_. **/
	private append_property_value(property: ts.ObjectLiteralElementLike, visitor: CallableExpressionVisitor): boolean {
		if (ts.isSpreadAssignment(property)) {
			this._object_sources.append(property.expression, (source) => {
				this.object_lookup(source).append_value(visitor);
			});
			return false;
		}
		if (property.name === undefined) {
			return false;
		}
		if (this._expression_names.static_property_name(property.name) !== this._property_name) {
			return false;
		}
		if (!ts.isPropertyAssignment(property)) {
			return false;
		}
		visitor(property.initializer);
		return true;
	}

	/** Responsibilities: _property lookup initialization_. **/
	public constructor(
		initializer: ts.ObjectLiteralExpression,
		property_name: string,
		expression_names: ExpressionNamesContract,
		object_sources: FactoryObjectSourcesContract,
	) {
		this._initializer = initializer;
		this._property_name = property_name;
		this._expression_names = expression_names;
		this._object_sources = object_sources;
	}

	/** Responsibilities: _property value traversal_. **/
	public append_value(visitor: CallableExpressionVisitor): void {
		for (let index = this._initializer.properties.length - 1; index >= 0; index -= 1) {
			const property = this._initializer.properties[index];
			if (property !== undefined && this.append_property_value(property, visitor)) {
				return;
			}
		}
	}

	/** Responsibilities: _property source resolution_. **/
	public property_source(): string {
		for (let index = this._initializer.properties.length - 1; index >= 0; index -= 1) {
			const property = this._initializer.properties[index];
			if (property === undefined) {
				continue;
			}
			const source = this.source_property(property);
			if (source !== "") {
				return source;
			}
		}
		return "";
	}
}
