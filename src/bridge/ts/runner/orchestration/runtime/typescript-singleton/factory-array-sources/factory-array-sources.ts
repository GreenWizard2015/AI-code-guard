import ts from "typescript";
import type { ArrayValuesVisitor } from "src/protocols";
import { TypeScriptFactoryArrayObjectSources } from "src/bridge/ts/runner/orchestration/runtime/typescript-singleton/factory-array-sources/factory-array-object-sources";
import type { FactoryObjectSourcesContract } from "src/bridge/ts/runner/orchestration/runtime/protocols";
import { TypeScriptExpressionNames } from "src/typescript-aliases/typescript-expression-names";

/** Responsibilities: _resolution factory array sources_. **/
export class TypeScriptFactoryArraySources {
	private readonly expression_names = new TypeScriptExpressionNames();
	private readonly source_file: ts.SourceFile;
	private readonly array_sources = new Map<string, ts.ArrayLiteralExpression>();
	public readonly binding_sources: TypeScriptFactoryArrayObjectSources;

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
		visit(this.source_file);
		return declarations;
	}

	/** Responsibilities: _array spread values_. **/
	private append_array_value(values: ts.Expression[], element: ts.Expression): void {
		if (!ts.isSpreadElement(element)) {
			values.push(element);
			return;
		}
		const source = this.expression_names.unwrap_transparent_expression(element.expression);
		if (ts.isArrayLiteralExpression(source)) {
			values.push(...this.elements(source));
			return;
		}
		if (!ts.isIdentifier(source)) {
			return;
		}
		const array_source = this.array_sources.get(source.text);
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
		const initializer = this.expression_names.unwrap_transparent_expression(declaration.initializer);
		if (ts.isArrayLiteralExpression(initializer)) {
			return this.append_literal_source(declaration.name.text, initializer);
		}
		if (!ts.isIdentifier(initializer)) {
			return false;
		}
		return this.append_alias_source(declaration.name.text, initializer.text);
	}

	/** Responsibilities: _register array literal_. **/
	private append_literal_source(name: string, source: ts.ArrayLiteralExpression): boolean {
		if (this.array_sources.has(name)) {
			return false;
		}
		this.array_sources.set(name, source);
		return true;
	}

	/** Responsibilities: _register array alias_. **/
	private append_alias_source(name: string, alias: string): boolean {
		const source = this.array_sources.get(alias);
		if (source === undefined) {
			return false;
		}
		if (this.array_sources.has(name)) {
			return false;
		}
		this.array_sources.set(name, source);
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
		const source = this.expression_names.unwrap_transparent_expression(initializer);
		if (ts.isArrayLiteralExpression(source)) {
			return this.elements(source);
		}
		if (!ts.isIdentifier(source)) {
			return [];
		}
		const array_source = this.array_sources.get(source.text);
		if (array_source === undefined) {
			return [];
		}
		return this.elements(array_source);
	}

	/** Responsibilities: _initialization factory array sources_. **/
	public constructor(source_file: ts.SourceFile, object_sources: FactoryObjectSourcesContract) {
		this.source_file = source_file;
		this.binding_sources = new TypeScriptFactoryArrayObjectSources(object_sources, (initializer) =>
			this.elements(initializer),
		);
	}

	/** Responsibilities: _array source dispatch_. **/
	public append(expression: ts.Expression, visitor: ArrayValuesVisitor): void {
		this.register_array_sources();
		const source = this.expression_names.unwrap_transparent_expression(expression);
		if (ts.isArrayLiteralExpression(source)) {
			visitor(this.elements(source));
			return;
		}
		if (ts.isIdentifier(source)) {
			const array_source = this.array_sources.get(source.text);
			if (array_source !== undefined) {
				visitor(this.elements(array_source));
			}
		}
	}

	/** Responsibilities: _array binding elements_. **/
	public binding_elements(declaration: ts.VariableDeclaration): readonly ts.BindingElement[] {
		const elements: ts.BindingElement[] = [];
		if (!ts.isArrayBindingPattern(declaration.name)) {
			return elements;
		}
		for (const element of declaration.name.elements) {
			if (ts.isBindingElement(element)) {
				elements.push(element);
			}
		}
		return elements;
	}

	/** Responsibilities: _binding array values_. **/
	public values(declaration: ts.VariableDeclaration): readonly ts.Expression[] {
		if (!ts.isArrayBindingPattern(declaration.name)) {
			return [];
		}
		if (declaration.initializer === undefined) {
			return [];
		}
		this.register_array_sources();
		return this.values_from_initializer(declaration.initializer);
	}

	/** Responsibilities: _array literal elements_. **/
	public elements(initializer: ts.ArrayLiteralExpression): readonly ts.Expression[] {
		const values: ts.Expression[] = [];
		for (const element of initializer.elements) {
			this.append_array_value(values, element);
		}
		return values;
	}
}
