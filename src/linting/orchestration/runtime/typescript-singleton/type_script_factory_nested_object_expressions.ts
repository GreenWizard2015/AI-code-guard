import type { TypeScriptFactoryNestedObjectExpressionsContract } from "src/contracts/protocols/lint_runtime_protocols";
import { TypeScriptFactoryNestedObjectExpressionWalk } from "src/linting/orchestration/runtime/typescript-singleton/type_script_factory_nested_object_expression_walk";
import type {
	TypeScriptFactoryArrayAliasesContract,
	TypeScriptFactoryObjectPropertiesContract,
} from "src/typescript_runtime_protocols";
import type ts from "typescript";

/** Responsibilities: _nested expression collection_, _spread property resolution_. **/
export class TypeScriptFactoryNestedObjectExpressions implements TypeScriptFactoryNestedObjectExpressionsContract {
	private readonly _object_sources: Map<string, ts.ObjectLiteralExpression>;
	private readonly _properties: TypeScriptFactoryObjectPropertiesContract;
	private readonly _array_aliases: TypeScriptFactoryArrayAliasesContract;

	/** Responsibilities: _initialization nested object expressions_. **/
	public constructor(
		object_sources: Map<string, ts.ObjectLiteralExpression>,
		properties: TypeScriptFactoryObjectPropertiesContract,
		array_aliases: TypeScriptFactoryArrayAliasesContract,
	) {
		this._object_sources = object_sources;
		this._properties = properties;
		this._array_aliases = array_aliases;
	}

	/** Responsibilities: _nested object expression sources_. **/
	public expressions(
		initializer: ts.ObjectLiteralExpression,
		binding: ts.ObjectBindingPattern,
		name: string,
	): ReadonlyMap<string, ts.FunctionLikeDeclarationBase> {
		const expressions = new Map<string, ts.FunctionLikeDeclarationBase>();
		const walk = new TypeScriptFactoryNestedObjectExpressionWalk({
			initializer,
			binding,
			name,
			expressions,
			object_sources: this._object_sources,
			properties: this._properties,
			array_aliases: this._array_aliases,
		});
		walk.expressions();
		return expressions;
	}

	/** Responsibilities: _nested expression collection_. **/
	public append(
		initializer: ts.ObjectLiteralExpression,
		binding: ts.ObjectBindingPattern,
		name: string,
		expressions: Map<string, ts.FunctionLikeDeclarationBase>,
	): void {
		const walk = new TypeScriptFactoryNestedObjectExpressionWalk({
			initializer,
			binding,
			name,
			expressions,
			object_sources: this._object_sources,
			properties: this._properties,
			array_aliases: this._array_aliases,
		});
		walk.append();
	}
}
