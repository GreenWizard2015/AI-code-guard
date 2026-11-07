import type { TypeScriptFactoryNestedObjectExpressionsContract } from "src/contracts/protocols/lint_runtime_protocols";
import { TypeScriptFactoryNestedObjectExpressions } from "src/linting/orchestration/runtime/typescript-singleton/type_script_factory_nested_object_expressions";
import { TypeScriptFactoryObjectPropertyLookup } from "src/linting/orchestration/runtime/typescript-singleton/type_script_factory_object_property_lookup";
import { TypeScriptExpressionNames } from "src/parser/typescript-aliases/type_script_expression_names";
import type { ExpressionNamesContract } from "src/runtime_protocols";
import type {
	TypeScriptFactoryArrayAliasesContract,
	TypeScriptFactoryObjectPropertiesContract,
	TypeScriptFactoryObjectPropertyLookupContract,
} from "src/typescript_runtime_protocols";
import type ts from "typescript";

/** Responsibilities: _object property resolution_, _binding expression lookup_. **/
export class TypeScriptFactoryObjectProperties implements TypeScriptFactoryObjectPropertiesContract {
	private readonly _expression_names: ExpressionNamesContract;
	private readonly _object_sources: Map<string, ts.ObjectLiteralExpression>;
	private readonly _nested_expressions: TypeScriptFactoryNestedObjectExpressionsContract;

	/** Responsibilities: _initialization factory object properties_. **/
	public constructor(
		object_sources: Map<string, ts.ObjectLiteralExpression>,
		array_aliases: TypeScriptFactoryArrayAliasesContract,
	) {
		this._expression_names = new TypeScriptExpressionNames();
		this._object_sources = object_sources;
		this._nested_expressions = new TypeScriptFactoryNestedObjectExpressions(object_sources, this, array_aliases);
	}

	/** Responsibilities: _factory expression source_. **/
	public property_context(
		initializer: ts.ObjectLiteralExpression,
		property_name: string,
	): TypeScriptFactoryObjectPropertyLookupContract {
		return new TypeScriptFactoryObjectPropertyLookup(
			initializer,
			property_name,
			this._object_sources,
			this._expression_names,
			new Map<string, ts.FunctionLikeDeclarationBase>(),
		);
	}

	/** Responsibilities: _static property name_. **/
	public property_key(property: ts.ObjectLiteralElementLike): string {
		if (property.name === undefined) {
			return "";
		}
		return this._expression_names.static_property_name(property.name);
	}

	/** Responsibilities: _binding expression sources_. **/
	public binding_expressions(
		initializer: ts.ObjectLiteralExpression,
		binding: ts.ObjectBindingPattern,
		name: string,
	): ReadonlyMap<string, ts.FunctionLikeDeclarationBase> {
		const expressions = new Map<string, ts.FunctionLikeDeclarationBase>();
		for (const expression of this._nested_expressions.expressions(initializer, binding, name).values()) {
			expressions.set(name, expression);
		}
		return expressions;
	}
}
