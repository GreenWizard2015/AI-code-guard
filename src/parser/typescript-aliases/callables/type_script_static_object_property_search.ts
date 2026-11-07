import { TypeScriptExpressionAliases } from "src/parser/typescript-aliases/type_script_expression_aliases";
import { TypeScriptObjectAliasDeclarationIndex } from "src/parser/typescript-aliases/type_script_object_alias_declaration_index";
import type { CallableStaticObjectValueAppender } from "src/runtime_types";
import type {
	TypeScriptStaticObjectPropertySearchOptions,
	TypeScriptStaticObjectValuesContract,
} from "src/typescript_analysis_protocols";
import type { TypeScriptExpressionAliasesContract } from "src/typescript_runtime_protocols";
import ts from "typescript";

/** Responsibilities: _static object property search_, _spread precedence resolution_. **/
export class TypeScriptStaticObjectPropertySearch {
	private readonly _value_resolver: TypeScriptStaticObjectValuesContract;
	private readonly _objects: Map<string, ts.ObjectLiteralExpression>;
	private readonly _source_name: string;
	private readonly _seen: Set<ts.ObjectLiteralExpression>;
	private readonly _append_value: CallableStaticObjectValueAppender;
	private readonly _expression_aliases: TypeScriptExpressionAliasesContract;

	/** Responsibilities: _named property value resolution_. **/
	private append_named_property(property: ts.ObjectLiteralElementLike): boolean {
		if (ts.isPropertyAssignment(property)) {
			if (this._value_resolver.property_name(property.name) !== this._source_name) {
				return false;
			}
			return this._append_value(property.initializer);
		}
		if (ts.isShorthandPropertyAssignment(property)) {
			if (this._value_resolver.property_name(property.name) === this._source_name) {
				return this._append_value(property.name);
			}
		}
		return false;
	}

	/** Responsibilities: _object property resolution_. **/
	private append_property(property: ts.ObjectLiteralElementLike): boolean {
		if (this.append_named_property(property)) {
			return true;
		}
		if (!ts.isSpreadAssignment(property)) {
			return false;
		}
		return this.append_spread(property);
	}

	/** Responsibilities: _static object search initialization_. **/
	public constructor(options: TypeScriptStaticObjectPropertySearchOptions) {
		this._value_resolver = options.value_resolver;
		this._objects = options.objects;
		this._source_name = options.source_name;
		this._seen = options.seen;
		this._append_value = options.append_value;
		this._expression_aliases = new TypeScriptExpressionAliases("", new TypeScriptObjectAliasDeclarationIndex());
	}

	/** Responsibilities: _spread property value resolution_. **/
	public append_spread(property: ts.SpreadAssignment): boolean {
		const current = this._expression_aliases.unwrapped(property.expression);
		if (ts.isObjectLiteralExpression(current)) {
			return this.append(current);
		}
		if (!ts.isIdentifier(current)) {
			return false;
		}
		const object = this._objects.get(current.text);
		if (object === undefined) {
			return false;
		}
		return this.append(object);
	}

	/** Responsibilities: _object properties traversal_. **/
	public append(initializer: ts.ObjectLiteralExpression): boolean {
		if (this._seen.has(initializer)) {
			return false;
		}
		this._seen.add(initializer);
		for (let index = initializer.properties.length - 1; index >= 0; index -= 1) {
			const property = initializer.properties[index];
			if (property !== undefined && this.append_property(property)) {
				return true;
			}
		}
		return false;
	}
}
