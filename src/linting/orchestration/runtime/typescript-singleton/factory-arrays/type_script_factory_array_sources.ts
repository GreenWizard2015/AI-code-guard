import type {
	FactoryObjectSourcesContract,
	TypeScriptFactoryArrayBindingData,
	TypeScriptFactoryArrayObjectSourcesContract,
	TypeScriptFactoryArraySourcesContract,
} from "src/contracts/protocols/lint_runtime_protocols";
import { TypeScriptFactoryArrayObjectSources } from "src/linting/orchestration/runtime/typescript-singleton/factory-arrays/type_script_factory_array_object_sources";
import { TypeScriptExpressionNames } from "src/parser/typescript-aliases/type_script_expression_names";
import type { ExpressionNamesContract } from "src/runtime_protocols";
import type { CallableArrayValuesVisitor } from "src/runtime_types";
import ts from "typescript";

/** Responsibilities: _array factory source registration_, _array initializer resolution_. **/
export class TypeScriptFactoryArraySources implements TypeScriptFactoryArraySourcesContract {
	private readonly _expression_names: ExpressionNamesContract;
	private readonly _source_file: ts.SourceFile;
	private readonly _array_sources: Map<string, ts.ArrayLiteralExpression>;
	private readonly _object_sources: FactoryObjectSourcesContract;
	private readonly _binding_source_cache: Map<string, TypeScriptFactoryArrayObjectSourcesContract>;

	/** Responsibilities: _module variable collection_. **/
	private variable_declarations(): readonly ts.VariableDeclaration[] {
		const declarations: ts.VariableDeclaration[] = [];
		const visit = (node: ts.Node): void => {
			if (ts.isFunctionLike(node) || ts.isClassLike(node)) {
				return;
			}
			if (ts.isVariableDeclaration(node)) {
				declarations.push(node);
				return;
			}
			ts.forEachChild(node, visit);
		};
		visit(this._source_file);
		return declarations;
	}

	/** Responsibilities: _array spread values_. **/
	private append_array_value(values: ts.Expression[], element: ts.Expression): void {
		if (!ts.isSpreadElement(element)) {
			values.push(element);
			return;
		}
		const source = this._expression_names.unwrap_transparent_expression(element.expression);
		if (ts.isArrayLiteralExpression(source)) {
			values.push(...this.elements(source));
			return;
		}
		if (!ts.isIdentifier(source)) {
			return;
		}
		const array_source = this._array_sources.get(source.text);
		if (array_source !== undefined) {
			values.push(...this.elements(array_source));
		}
	}

	/** Responsibilities: _array source registration_. **/
	private append_source(declaration: ts.VariableDeclaration): boolean {
		if (!ts.isIdentifier(declaration.name)) {
			return false;
		}
		if (declaration.initializer === undefined) {
			return false;
		}
		const initializer = this._expression_names.unwrap_transparent_expression(declaration.initializer);
		if (ts.isArrayLiteralExpression(initializer)) {
			return this.append_literal_source(declaration.name.text, initializer);
		}
		if (!ts.isIdentifier(initializer)) {
			return false;
		}
		return this.append_alias_source(declaration.name.text, initializer.text);
	}

	/** Responsibilities: _register array literal_. **/
	private append_literal_source(array_name: string, source: ts.ArrayLiteralExpression): boolean {
		if (this._array_sources.has(array_name)) {
			return false;
		}
		this._array_sources.set(array_name, source);
		return true;
	}

	/** Responsibilities: _register array alias_. **/
	private append_alias_source(array_name: string, alias_name: string): boolean {
		const source = this._array_sources.get(alias_name);
		if (source === undefined) {
			return false;
		}
		if (this._array_sources.has(array_name)) {
			return false;
		}
		this._array_sources.set(array_name, source);
		return true;
	}

	/** Responsibilities: _array source collection_. **/
	private register_array_sources(): void {
		let changed = true;
		while (changed) {
			changed = false;
			for (const declaration of this.variable_declarations()) {
				if (this.append_source(declaration)) {
					changed = true;
				}
			}
		}
	}

	/** Responsibilities: _binding initializer values_. **/
	private values_from_initializer(initializer: ts.Expression): readonly ts.Expression[] {
		const source = this._expression_names.unwrap_transparent_expression(initializer);
		if (ts.isArrayLiteralExpression(source)) {
			return this.elements(source);
		}
		if (!ts.isIdentifier(source)) {
			return [];
		}
		const array_source = this._array_sources.get(source.text);
		if (array_source === undefined) {
			return [];
		}
		return this.elements(array_source);
	}

	/** Responsibilities: _named binding source resolver_. **/
	private binding_sources(factory_name: string): TypeScriptFactoryArrayObjectSourcesContract {
		const cached = this._binding_source_cache.get(factory_name);
		if (cached !== undefined) {
			return cached;
		}
		const resolver = new TypeScriptFactoryArrayObjectSources(factory_name, this._object_sources, this);
		this._binding_source_cache.set(factory_name, resolver);
		return resolver;
	}

	/** Responsibilities: _initialization factory array sources_. **/
	public constructor(source_file: ts.SourceFile, object_sources: FactoryObjectSourcesContract) {
		this._expression_names = new TypeScriptExpressionNames();
		this._array_sources = new Map<string, ts.ArrayLiteralExpression>();
		this._binding_source_cache = new Map<string, TypeScriptFactoryArrayObjectSourcesContract>();
		this._source_file = source_file;
		this._object_sources = object_sources;
	}

	/** Responsibilities: _array source dispatch_. **/
	public append(expression: ts.Expression, visitor: CallableArrayValuesVisitor): void {
		this.register_array_sources();
		const source = this._expression_names.unwrap_transparent_expression(expression);
		if (ts.isArrayLiteralExpression(source)) {
			visitor(this.elements(source));
			return;
		}
		if (ts.isIdentifier(source)) {
			const array_source = this._array_sources.get(source.text);
			if (array_source !== undefined) {
				visitor(this.elements(array_source));
			}
		}
	}

	/** Responsibilities: _array binding data assembly_. **/
	public binding_data(declaration: ts.VariableDeclaration): TypeScriptFactoryArrayBindingData {
		const elements: ts.BindingElement[] = [];
		if (!ts.isArrayBindingPattern(declaration.name)) {
			return { elements, values: [] };
		}
		for (const element of declaration.name.elements) {
			if (ts.isBindingElement(element)) {
				elements.push(element);
			}
		}
		let values: readonly ts.Expression[] = [];
		if (declaration.initializer !== undefined) {
			this.register_array_sources();
			values = this.values_from_initializer(declaration.initializer);
		}
		return { elements, values };
	}

	/** Responsibilities: _array literal elements_. **/
	public elements(initializer: ts.ArrayLiteralExpression): readonly ts.Expression[] {
		const values: ts.Expression[] = [];
		for (const element of initializer.elements) {
			this.append_array_value(values, element);
		}
		return values;
	}

	/** Responsibilities: _array binding source resolution_. **/
	public binding_source(
		binding: ts.ArrayBindingPattern,
		values: readonly ts.Expression[],
		factory_name: string,
	): string {
		if (values.length === 0 || factory_name.length === 0) {
			return "";
		}
		const resolver = this.binding_sources(factory_name);
		return resolver.binding_source(binding, values);
	}
}
