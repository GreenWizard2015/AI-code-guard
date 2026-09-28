import ts from 'typescript';
import { TypeScriptNamespaceAliases } from 'src/bridge/ts/runner/orchestration/runtime/typescript-singleton/namespace-aliases';
import { TypeScriptExpressionNames } from 'src/typescript-aliases/typescript-expression-names';

/** Responsibilities: _array alias resolution_. **/
export class TypeScriptArrayDestructuredAliases {
	private readonly expression_names = new TypeScriptExpressionNames();
	private readonly names: Set<string>;
	private readonly sources = new Map<string, ts.ArrayLiteralExpression>();
	private readonly namespace_aliases: TypeScriptNamespaceAliases;

	/** Responsibilities: _collection class alias name_. **/
	private append_name_alias(name: string, target: string): boolean {
		if (target === '') {
			return false;
		}
		if (!this.names.has(target)) {
			return false;
		}
		if (this.names.has(name)) {
			return false;
		}
		this.names.add(name);
		return true;
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
		if (source === undefined || ts.isSpreadElement(source)) {
			return false;
		}
		const expression = this.expression_names.unwrap_transparent_expression(source);
		let target = '';
		if (ts.isIdentifier(expression)) {
			target = expression.text;
		} else {
			target = this.namespace_aliases.target(expression);
		}
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
			if (!ts.isBindingElement(element)) {
				continue;
			}
			if (this.append_array_alias(initializer, element, index)) {
				changed = true;
			}
		}
		return changed;
	}

	/** Responsibilities: _collection array source aliases_. **/
	private append_source(
		declaration: ts.VariableDeclaration,
		elements: readonly ts.ArrayBindingElement[],
	): boolean {
		if (declaration.initializer === undefined) {
			return false;
		}
		let initializer = this.expression_names.unwrap_transparent_expression(declaration.initializer);
		if (ts.isIdentifier(initializer)) {
			const source = this.sources.get(initializer.text);
			if (source === undefined) {
				return false;
			}
			initializer = source;
		}
		if (!ts.isArrayLiteralExpression(initializer)) {
			return false;
		}
		return this.append_elements(initializer, elements);
	}

	/** Responsibilities: _collection array source registration_. **/
	private register_source(declaration: ts.VariableDeclaration): void {
		if (!ts.isIdentifier(declaration.name) || declaration.initializer === undefined) {
			return;
		}
		let initializer = this.expression_names.unwrap_transparent_expression(declaration.initializer);
		if (ts.isIdentifier(initializer)) {
			const source = this.sources.get(initializer.text);
			if (source === undefined) {
				return;
			}
			initializer = source;
		}
		if (ts.isArrayLiteralExpression(initializer)) {
			this.sources.set(declaration.name.text, initializer);
		}
	}

	/** Responsibilities: _initialization array alias names_. **/
	public constructor(names: Set<string>, source_file: ts.SourceFile) {
		this.names = names;
		this.namespace_aliases = new TypeScriptNamespaceAliases(source_file);
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
		return this.append_source(declaration, declaration.name.elements);
	}
}
