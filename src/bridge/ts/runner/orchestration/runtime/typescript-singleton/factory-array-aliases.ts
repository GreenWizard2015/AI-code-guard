import ts from "typescript";
import { TypeScriptFactoryArraySources } from "src/bridge/ts/runner/orchestration/runtime/typescript-singleton/factory-array-sources/factory-array-sources";
import { TypeScriptFactoryArrayObjectExpressions } from "src/bridge/ts/runner/orchestration/runtime/typescript-singleton/factory-array-object-expressions";
import { TypeScriptFactoryObjectSources } from "src/bridge/ts/runner/orchestration/runtime/typescript-singleton/factory-object-sources";
import type { FactoryObjectSourcesContract } from "src/bridge/ts/runner/orchestration/runtime/protocols";
import { TypeScriptExpressionNames } from "src/typescript-aliases/typescript-expression-names";

/** Responsibilities: _resolution array factory aliases_. **/
export class TypeScriptFactoryArrayAliases {
	private readonly expression_names = new TypeScriptExpressionNames();
	private readonly sources: TypeScriptFactoryArraySources;
	private readonly object_sources: FactoryObjectSourcesContract;
	private readonly source_file: ts.SourceFile;

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

	/** Responsibilities: _array inline factory_. **/
	private append_expression(
		element: ts.Node,
		value: ts.Expression,
		name: string,
		expressions: Map<string, ts.FunctionLikeDeclarationBase>,
	): void {
		if (ts.isArrayBindingPattern(element)) {
			this.append_nested_expression(element, value, name, expressions);
			return;
		}
		if (!ts.isBindingElement(element)) {
			return;
		}
		if (ts.isArrayBindingPattern(element.name)) {
			this.append_nested_expression(element.name, value, name, expressions);
			return;
		}
		if (ts.isObjectBindingPattern(element.name)) {
			this.append_object_expression(element.name, value, name, expressions);
			return;
		}
		this.append_direct_expression(element, value, name, expressions);
	}

	/** Responsibilities: _object factory expression_. **/
	private append_object_expression(
		binding: ts.ObjectBindingPattern,
		value: ts.Expression,
		name: string,
		expressions: Map<string, ts.FunctionLikeDeclarationBase>,
	): void {
		this.object_sources.append(value, (source) => {
			const resolver = new TypeScriptFactoryArrayObjectExpressions(
				source,
				name,
				(expression, visitor) => this.object_sources.append(expression, visitor),
				(binding, initializer, nested_name) => this.nested_expressions(binding, initializer, nested_name),
			);
			for (const expression of resolver.expressions(binding).values()) {
				expressions.set(name, expression);
			}
		});
	}

	/** Responsibilities: _direct inline factory_. **/
	private append_direct_expression(
		element: ts.BindingElement,
		value: ts.Expression,
		name: string,
		expressions: Map<string, ts.FunctionLikeDeclarationBase>,
	): void {
		if (!ts.isIdentifier(element.name)) {
			return;
		}
		if (element.name.text !== name) {
			return;
		}
		const expression = this.expression_names.unwrap_transparent_expression(value);
		if (ts.isArrowFunction(expression) || ts.isFunctionExpression(expression)) {
			expressions.set(name, expression);
		}
	}

	/** Responsibilities: _array binding expressions_. **/
	private binding_expressions(
		binding: ts.ArrayBindingPattern,
		values: readonly ts.Expression[],
		name: string,
	): ReadonlyMap<string, ts.FunctionLikeDeclarationBase> {
		const expressions = new Map<string, ts.FunctionLikeDeclarationBase>();
		for (let index = 0; index < binding.elements.length; index += 1) {
			const value = values[index];
			if (value === undefined) {
				continue;
			}
			this.append_expression(binding.elements[index], value, name, expressions);
		}
		return expressions;
	}

	/** Responsibilities: _nested inline factory_. **/
	private append_nested_expression(
		binding: ts.ArrayBindingPattern,
		value: ts.Expression,
		name: string,
		expressions: Map<string, ts.FunctionLikeDeclarationBase>,
	): void {
		const source = this.expression_names.unwrap_transparent_expression(value);
		if (!ts.isArrayLiteralExpression(source)) {
			return;
		}
		const values = this.sources.elements(source);
		for (let index = 0; index < binding.elements.length; index += 1) {
			const nested_value = values[index];
			if (nested_value === undefined) {
				continue;
			}
			this.append_expression(binding.elements[index], nested_value, name, expressions);
		}
	}

	/** Responsibilities: _nested array factory names_. **/
	private append_binding_name(name: ts.BindingName, names: Set<string>): void {
		if (ts.isIdentifier(name)) {
			names.add(name.text);
			return;
		}
		for (const element of name.elements) {
			if (ts.isBindingElement(element)) {
				this.append_binding_name(element.name, names);
				continue;
			}
			if (ts.isArrayBindingPattern(element)) {
				this.append_binding_name(element, names);
			}
		}
	}

	/** Responsibilities: _initialization array factory aliases_. **/
	public constructor(source_file: ts.SourceFile) {
		this.source_file = source_file;
		this.object_sources = new TypeScriptFactoryObjectSources(source_file);
		this.sources = new TypeScriptFactoryArraySources(source_file, this.object_sources);
	}

	/** Responsibilities: _collection array factory names_. **/
	public names(): ReadonlySet<string> {
		const names = new Set<string>();
		for (const declaration of this.variable_declarations()) {
			for (const element of this.sources.binding_elements(declaration)) {
				this.append_binding_name(element.name, names);
			}
		}
		return names;
	}

	/** Responsibilities: _collection inline array factories_. **/
	public expressions(
		declaration: ts.VariableDeclaration,
		name: string,
	): ReadonlyMap<string, ts.FunctionLikeDeclarationBase> {
		const expressions = new Map<string, ts.FunctionLikeDeclarationBase>();
		if (!ts.isArrayBindingPattern(declaration.name)) {
			return expressions;
		}
		return this.binding_expressions(declaration.name, this.sources.values(declaration), name);
	}

	/** Responsibilities: _nested array expressions_. **/
	public nested_expressions(
		binding: ts.ArrayBindingPattern,
		initializer: ts.Expression,
		name: string,
	): ReadonlyMap<string, ts.FunctionLikeDeclarationBase> {
		const expressions = new Map<string, ts.FunctionLikeDeclarationBase>();
		this.sources.append(initializer, (values) => {
			for (const [alias_name, expression] of this.binding_expressions(binding, values, name)) {
				expressions.set(alias_name, expression);
			}
		});
		return expressions;
	}

	/** Responsibilities: _resolution array factory source_. **/
	public source(declaration: ts.VariableDeclaration, name: string): string {
		if (!ts.isArrayBindingPattern(declaration.name)) {
			return "";
		}
		return this.sources.binding_sources.binding_source(declaration.name, this.sources.values(declaration), name);
	}
}
