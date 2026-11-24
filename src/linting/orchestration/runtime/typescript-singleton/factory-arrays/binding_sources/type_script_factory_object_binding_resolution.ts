import type { CallableArraySourceResolver } from "src/analysis_types";
import type {
	FactoryObjectSourcesContract,
	TypeScriptFactoryObjectBindingResolutionContract,
	TypeScriptFactoryObjectBindingResolutionOptions,
} from "src/contracts/protocols/lint_runtime_protocols";
import { TypeScriptFactoryObjectPropertyLookup } from "src/linting/orchestration/runtime/typescript-singleton/factory-arrays/type_script_factory_object_property_lookup";
import type { ExpressionNamesContract } from "src/runtime_protocols";
import ts from "typescript";

/** Responsibilities: _object binding resolution_, _nested binding traversal_. **/
export class TypeScriptFactoryObjectBindingResolution implements TypeScriptFactoryObjectBindingResolutionContract {
	private readonly _array_source: CallableArraySourceResolver;
	private readonly _binding: ts.ObjectBindingPattern;
	private readonly _expression_names: ExpressionNamesContract;
	private readonly _initializer: ts.ObjectLiteralExpression;
	private readonly _name: string;
	private readonly _object_sources: FactoryObjectSourcesContract;

	/** Responsibilities: _direct binding source_. **/
	private direct_binding_source(): string {
		for (const element of this._binding.elements) {
			if (!ts.isBindingElement(element) || !ts.isIdentifier(element.name)) {
				continue;
			}
			if (element.name.text !== this._name) {
				continue;
			}
			const lookup = new TypeScriptFactoryObjectPropertyLookup(
				this._initializer,
				this._expression_names.static_binding_name(element),
				this._expression_names,
				this._object_sources,
			);
			return lookup.property_source();
		}
		return "";
	}

	/** Responsibilities: _nested object binding source_. **/
	private nested_object_source(value: ts.Expression, binding: ts.ObjectBindingPattern): string {
		let result = "";
		this._object_sources.append(value, (initializer) => {
			const resolution = new TypeScriptFactoryObjectBindingResolution({
				initializer,
				binding,
				name: this._name,
				array_source: this._array_source,
				expression_names: this._expression_names,
				object_sources: this._object_sources,
			});
			result = resolution.resolve();
		});
		return result;
	}

	/** Responsibilities: _binding resolution initialization_. **/
	public constructor(options: TypeScriptFactoryObjectBindingResolutionOptions) {
		this._initializer = options.initializer;
		this._binding = options.binding;
		this._name = options.name;
		this._array_source = options.array_source;
		this._expression_names = options.expression_names;
		this._object_sources = options.object_sources;
	}

	/** Responsibilities: _nested binding source_. **/
	public nested_binding_source(element: ts.BindingElement): string {
		let result = "";
		const property_name = this._expression_names.static_binding_name(element);
		const lookup = new TypeScriptFactoryObjectPropertyLookup(
			this._initializer,
			property_name,
			this._expression_names,
			this._object_sources,
		);
		lookup.append_value((value) => {
			if (ts.isObjectBindingPattern(element.name)) {
				result = this.nested_object_source(value, element.name);
				return;
			}
			if (ts.isArrayBindingPattern(element.name)) {
				result = this._array_source(element.name, value, this._name);
			}
		});
		return result;
	}

	/** Responsibilities: _binding source resolution_. **/
	public resolve(): string {
		const direct = this.direct_binding_source();
		if (direct !== "") {
			return direct;
		}
		for (const element of this._binding.elements) {
			if (!ts.isBindingElement(element) || ts.isIdentifier(element.name)) {
				continue;
			}
			return this.nested_binding_source(element);
		}
		return "";
	}
}
