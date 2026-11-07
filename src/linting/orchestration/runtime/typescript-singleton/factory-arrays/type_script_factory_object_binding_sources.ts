import type { CallableArraySourceResolver } from "src/analysis_types";
import type { FactoryObjectSourcesContract } from "src/contracts/protocols/lint_runtime_protocols";
import type { TypeScriptFactoryObjectBindingSourcesContract } from "src/contracts/protocols/lint_runtime_protocols";
import { TypeScriptFactoryObjectBindingResolution } from "src/linting/orchestration/runtime/typescript-singleton/factory-arrays/type_script_factory_object_binding_resolution";
import { TypeScriptFactoryObjectPropertyLookup } from "src/linting/orchestration/runtime/typescript-singleton/factory-arrays/type_script_factory_object_property_lookup";
import { TypeScriptExpressionNames } from "src/parser/typescript-aliases/type_script_expression_names";
import type { ExpressionNamesContract } from "src/runtime_protocols";
import type ts from "typescript";

/** Responsibilities: _object binding source API_, _object property lookup API_. **/
export class TypeScriptFactoryObjectBindingSources implements TypeScriptFactoryObjectBindingSourcesContract {
	private readonly _expression_names: ExpressionNamesContract;
	private readonly _object_sources: FactoryObjectSourcesContract;

	/** Responsibilities: _resolver initialization_. **/
	public constructor(object_sources: FactoryObjectSourcesContract) {
		this._expression_names = new TypeScriptExpressionNames();
		this._object_sources = object_sources;
	}

	/** Responsibilities: _object binding source_, _object property source_. **/
	public property_source(initializer: ts.ObjectLiteralExpression, property_name: string): string {
		const lookup = new TypeScriptFactoryObjectPropertyLookup(
			initializer,
			property_name,
			this._expression_names,
			this._object_sources,
		);
		return lookup.property_source();
	}

	/** Responsibilities: _object binding resolution_. **/
	public source(
		initializer: ts.ObjectLiteralExpression,
		binding: ts.ObjectBindingPattern,
		name: string,
		array_source: CallableArraySourceResolver,
	): string {
		const resolution = new TypeScriptFactoryObjectBindingResolution({
			initializer,
			binding,
			name,
			array_source,
			expression_names: this._expression_names,
			object_sources: this._object_sources,
		});
		return resolution.resolve();
	}
}
