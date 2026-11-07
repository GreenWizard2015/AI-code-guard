import type {
	FactoryObjectSourcesContract,
	TypeScriptFactoryArrayObjectSourcesContract,
	TypeScriptFactoryArraySourcesContract,
	TypeScriptFactoryObjectBindingSourcesContract,
} from "src/contracts/protocols/lint_runtime_protocols";
import { TypeScriptFactoryArraySourceCandidate } from "src/linting/orchestration/runtime/typescript-singleton/factory-arrays/type_script_factory_array_source_candidate";
import { TypeScriptFactoryObjectBindingSources } from "src/linting/orchestration/runtime/typescript-singleton/factory-arrays/type_script_factory_object_binding_sources";
import { TypeScriptExpressionNames } from "src/parser/typescript-aliases/type_script_expression_names";
import type { ExpressionNamesContract } from "src/runtime_protocols";
import type ts from "typescript";

/** Responsibilities: _object binding source resolution_, _array binding source resolution_. **/
export class TypeScriptFactoryArrayObjectSources implements TypeScriptFactoryArrayObjectSourcesContract {
	private readonly _name: string;
	private readonly _expression_names: ExpressionNamesContract;
	private readonly _object_sources: FactoryObjectSourcesContract;
	private readonly _object_bindings: TypeScriptFactoryObjectBindingSourcesContract;
	private readonly _array_sources: TypeScriptFactoryArraySourcesContract;

	/** Responsibilities: _array source context setup_. **/
	public constructor(
		name: string,
		object_sources: FactoryObjectSourcesContract,
		array_sources: TypeScriptFactoryArraySourcesContract,
	) {
		this._name = name;
		this._expression_names = new TypeScriptExpressionNames();
		this._object_sources = object_sources;
		this._object_bindings = new TypeScriptFactoryObjectBindingSources(object_sources);
		this._array_sources = array_sources;
	}

	/** Responsibilities: _array object source_. **/
	public source(binding: ts.ObjectBindingPattern, expression: ts.Expression): string {
		let result = "";
		this._object_sources.append(expression, (initializer) => {
			result = this._object_bindings.source(
				initializer,
				binding,
				this._name,
				(nested_binding, nested_value, nested_name) => {
					const candidate = new TypeScriptFactoryArraySourceCandidate({
						element: nested_binding,
						value: nested_value,
						name: nested_name,
						expression_names: this._expression_names,
						object_sources: this._object_sources,
						object_bindings: this._object_bindings,
						array_sources: this._array_sources,
					});
					return candidate.source();
				},
			);
		});
		return result;
	}

	/** Responsibilities: _array binding source_. **/
	public binding_source(binding: ts.ArrayBindingPattern, values: readonly ts.Expression[]): string {
		let source = "";
		binding.elements.some((element, index) => {
			const value = values.at(index);
			if (element === undefined || value === undefined) {
				return false;
			}
			const candidate = new TypeScriptFactoryArraySourceCandidate({
				element,
				value,
				name: this._name,
				expression_names: this._expression_names,
				object_sources: this._object_sources,
				object_bindings: this._object_bindings,
				array_sources: this._array_sources,
			});
			source = candidate.source();
			return source.length > 0;
		});
		return source;
	}
}
