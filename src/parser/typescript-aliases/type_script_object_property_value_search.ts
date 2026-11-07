import type { ExpressionNamesContract } from "src/runtime_protocols";
import type { TypeScriptObjectAliasesContract } from "src/typescript_runtime_protocols";
import type { TypeScriptObjectPropertyValueSearchOptions } from "src/typescript_runtime_protocols";
import ts from "typescript";

/** Responsibilities: _object property value collection_, _spread source traversal_. **/
export class TypeScriptObjectPropertyValueSearch {
	private readonly _aliases: TypeScriptObjectAliasesContract;
	private readonly _expression_names: ExpressionNamesContract;
	private readonly _property_name: string;
	private readonly _seen: Set<ts.ObjectLiteralExpression>;
	private readonly _property_values: ts.Expression[];

	/** Responsibilities: _spread object source traversal_. **/
	private append_spread_source(expression: ts.Expression): void {
		const source = this._aliases.value(expression);
		if (ts.isObjectLiteralExpression(source)) {
			this.collect(source);
		}
	}

	/** Responsibilities: _single object property collection_. **/
	private append_property(property: ts.ObjectLiteralElementLike): void {
		if (ts.isPropertyAssignment(property)) {
			if (this._expression_names.static_property_name(property.name) === this._property_name) {
				this._property_values.push(property.initializer);
			}
			return;
		}
		if (ts.isShorthandPropertyAssignment(property)) {
			if (this._expression_names.static_property_name(property.name) === this._property_name) {
				this._property_values.push(property.name);
			}
			return;
		}
		if (!ts.isSpreadAssignment(property)) {
			return;
		}
		this.append_spread_source(property.expression);
	}

	/** Responsibilities: _property value search setup_. **/
	public constructor(options: TypeScriptObjectPropertyValueSearchOptions) {
		this._aliases = options.aliases;
		this._expression_names = options.expression_names;
		this._property_name = options.property_name;
		this._seen = new Set<ts.ObjectLiteralExpression>();
		this._property_values = [];
	}

	/** Responsibilities: _recursive object property collection_. **/
	public collect(object: ts.ObjectLiteralExpression): void {
		if (this._seen.has(object)) {
			return;
		}
		this._seen.add(object);
		for (const property of object.properties) {
			this.append_property(property);
		}
	}

	/** Responsibilities: _property value retrieval_. **/
	public values(): readonly ts.Expression[] {
		return this._property_values;
	}
}
