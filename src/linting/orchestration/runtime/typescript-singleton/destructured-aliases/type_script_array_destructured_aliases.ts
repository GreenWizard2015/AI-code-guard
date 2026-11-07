import { TypeScriptNamespaceAliases } from "src/linting/orchestration/runtime/typescript-singleton/destructured-aliases/type_script_namespace_aliases";
import { TypeScriptExpressionNames } from "src/parser/typescript-aliases/type_script_expression_names";
import type { ExpressionNamesContract } from "src/runtime_protocols";
import type { TypeScriptArrayDestructuredAliasesContract } from "src/typescript_analysis_protocols";
import type { TypeScriptNamespaceAliasesContract } from "src/typescript_runtime_protocols";
import ts from "typescript";

/** Responsibilities: _array alias registration_, _destructured target resolution_. **/
export class TypeScriptArrayDestructuredAliases implements TypeScriptArrayDestructuredAliasesContract {
	private readonly _expression_names: ExpressionNamesContract;
	private readonly _names: Set<string>;
	private readonly _sources: Map<string, ts.ArrayLiteralExpression>;
	private readonly _namespace_aliases: TypeScriptNamespaceAliasesContract;

	/** Responsibilities: _collection class alias name_. **/
	private append_name_alias(name: string, target: string): boolean {
		if (target === "") {
			return false;
		}
		if (!this._names.has(target)) {
			return false;
		}
		if (this._names.has(name)) {
			return false;
		}
		this._names.add(name);
		return true;
	}

	/** Responsibilities: _array alias target_. **/
	private alias_target(expression: ts.Expression): string {
		if (ts.isIdentifier(expression)) {
			return expression.text;
		}
		return this._namespace_aliases.target(expression);
	}

	/** Responsibilities: _collection array alias binding_. **/
	private append_array_alias(
		initializer: ts.ArrayLiteralExpression,
		element: ts.BindingElement,
		index: number,
	): boolean {
		if (!ts.isIdentifier(element.name)) {
			return false;
		}
		const source = initializer.elements[index];
		if (source === undefined) {
			return false;
		}
		if (ts.isSpreadElement(source)) {
			return false;
		}
		const expression = this._expression_names.unwrap_transparent_expression(source);
		const target = this.alias_target(expression);
		return this.append_name_alias(element.name.text, target);
	}

	/** Responsibilities: _collection array binding aliases_. **/
	private append_elements(
		initializer: ts.ArrayLiteralExpression,
		elements: readonly ts.ArrayBindingElement[],
	): boolean {
		let changed = false;
		for (let index = 0; index < elements.length; index += 1) {
			const element = elements[index];
			if (element === undefined || !ts.isBindingElement(element)) {
				continue;
			}
			if (this.append_array_alias(initializer, element, index)) {
				changed = true;
			}
		}
		return changed;
	}

	/** Responsibilities: _collection array source aliases_. **/
	private append_source(initializer: ts.Expression, elements: readonly ts.ArrayBindingElement[]): boolean {
		let source_expression = this._expression_names.unwrap_transparent_expression(initializer);
		if (ts.isIdentifier(source_expression)) {
			const source = this._sources.get(source_expression.text);
			if (source === undefined) {
				return false;
			}
			source_expression = source;
		}
		if (!ts.isArrayLiteralExpression(source_expression)) {
			return false;
		}
		return this.append_elements(source_expression, elements);
	}

	/** Responsibilities: _collection array source registration_. **/
	private register_source(declaration: ts.VariableDeclaration): void {
		if (!ts.isIdentifier(declaration.name)) {
			return;
		}
		if (declaration.initializer === undefined) {
			return;
		}
		let initializer = this._expression_names.unwrap_transparent_expression(declaration.initializer);
		if (ts.isIdentifier(initializer)) {
			const source = this._sources.get(initializer.text);
			if (source === undefined) {
				return;
			}
			initializer = source;
		}
		if (ts.isArrayLiteralExpression(initializer)) {
			this._sources.set(declaration.name.text, initializer);
		}
	}

	/** Responsibilities: _initialization array alias names_. **/
	public constructor(names: Set<string>, source_file: ts.SourceFile) {
		this._expression_names = new TypeScriptExpressionNames();
		this._sources = new Map<string, ts.ArrayLiteralExpression>();
		this._names = names;
		this._namespace_aliases = new TypeScriptNamespaceAliases(source_file);
	}

	/** Responsibilities: _collection array alias sources_. **/
	public register_sources(declarations: readonly ts.VariableDeclaration[]): void {
		for (const declaration of declarations) {
			this.register_source(declaration);
		}
	}

	/** Responsibilities: _collection array destructured aliases_. **/
	public array_aliases(declaration: ts.VariableDeclaration): boolean {
		if (!ts.isArrayBindingPattern(declaration.name)) {
			return false;
		}
		if (declaration.initializer === undefined) {
			return false;
		}
		return this.append_source(declaration.initializer, declaration.name.elements);
	}
}
