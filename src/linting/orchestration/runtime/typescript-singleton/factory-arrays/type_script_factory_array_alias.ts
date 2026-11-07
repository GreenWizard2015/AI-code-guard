import type {
	FactoryObjectSourcesContract,
	TypeScriptFactoryArraySourcesContract,
} from "src/contracts/protocols/lint_runtime_protocols";
import { TypeScriptFactoryArrayBindingTraversal } from "src/linting/orchestration/runtime/typescript-singleton/factory-arrays/type_script_factory_array_binding_traversal";
import type { ExpressionNamesContract } from "src/runtime_protocols";
import type { TypeScriptFactoryArrayAliasContract } from "src/typescript_runtime_protocols";
import ts from "typescript";

/** Responsibilities: _array factory alias identity_, _inline factory lookup_. **/
export class TypeScriptFactoryArrayAlias implements TypeScriptFactoryArrayAliasContract {
	private readonly _name: string;
	private readonly _expression_names: ExpressionNamesContract;
	private readonly _sources: TypeScriptFactoryArraySourcesContract;
	private readonly _object_sources: FactoryObjectSourcesContract;

	/** Responsibilities: _array factory alias ownership_. **/
	public constructor(
		name: string,
		expression_names: ExpressionNamesContract,
		sources: TypeScriptFactoryArraySourcesContract,
		object_sources: FactoryObjectSourcesContract,
	) {
		this._name = name;
		this._expression_names = expression_names;
		this._sources = sources;
		this._object_sources = object_sources;
	}

	/** Responsibilities: _inline array factory lookup_. **/
	public expressions(declaration: ts.VariableDeclaration): ReadonlyMap<string, ts.FunctionLikeDeclarationBase> {
		if (!ts.isArrayBindingPattern(declaration.name)) {
			return new Map();
		}
		const binding_data = this._sources.binding_data(declaration);
		const traversal = new TypeScriptFactoryArrayBindingTraversal(
			this._name,
			this._expression_names,
			this._sources,
			this._object_sources,
		);
		return traversal.binding_expressions(declaration.name, binding_data.values);
	}

	/** Responsibilities: _nested array factory lookup_. **/
	public nested_expressions(
		binding: ts.ArrayBindingPattern,
		initializer: ts.Expression,
	): ReadonlyMap<string, ts.FunctionLikeDeclarationBase> {
		const traversal = new TypeScriptFactoryArrayBindingTraversal(
			this._name,
			this._expression_names,
			this._sources,
			this._object_sources,
		);
		return traversal.nested_expressions(binding, initializer);
	}

	/** Responsibilities: _array factory source identity_. **/
	public source(declaration: ts.VariableDeclaration): string {
		if (!ts.isArrayBindingPattern(declaration.name)) {
			return "";
		}
		const binding_data = this._sources.binding_data(declaration);
		return this._sources.binding_source(declaration.name, binding_data.values, this._name);
	}
}
