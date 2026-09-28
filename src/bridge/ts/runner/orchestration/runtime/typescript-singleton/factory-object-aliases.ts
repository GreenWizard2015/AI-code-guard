import ts from 'typescript';
import { TypeScriptFactoryArrayAliases } from 'src/bridge/ts/runner/orchestration/runtime/typescript-singleton/factory-array-aliases';
import { TypeScriptFactoryObjectProperties } from 'src/bridge/ts/runner/orchestration/runtime/typescript-singleton/factory-object-properties';
import { TypeScriptFactoryObjectSources } from 'src/bridge/ts/runner/orchestration/runtime/typescript-singleton/factory-object-sources';
import type { FactoryObjectSourcesContract } from 'src/bridge/ts/runner/orchestration/runtime/protocols';
import { TypeScriptExpressionNames } from 'src/typescript-aliases/typescript-expression-names';

/** Responsibilities: _resolution object factory aliases_. **/
export class TypeScriptFactoryObjectAliases {
	private readonly expression_names = new TypeScriptExpressionNames();
	private readonly source_file: ts.SourceFile;
	private readonly object_source_registry: FactoryObjectSourcesContract;
	private readonly object_sources: Map<string, ts.ObjectLiteralExpression>;
	private readonly properties: TypeScriptFactoryObjectProperties;
	private readonly array_aliases: TypeScriptFactoryArrayAliases;

	/** Responsibilities: _module variable collection_. **/
	private variable_declarations(): readonly ts.VariableDeclaration[] {
		const declarations: ts.VariableDeclaration[] = [];
		const visit = (node: ts.Node): void => {
			if (ts.isFunctionLike(node)) {
				return;
			}
			if (ts.isClassLike(node)) {
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

	/** Responsibilities: _nested object factory names_. **/
	private append_binding_name(name: ts.BindingName, names: Set<string>): void {
		if (ts.isIdentifier(name)) {
			names.add(name.text);
			return;
		}
		for (const element of name.elements) {
			if (ts.isBindingElement(element)) {
				this.append_binding_name(element.name, names);
			}
		}
	}

	/** Responsibilities: _factory binding source_. **/
	private binding_source(
		binding: ts.ObjectBindingPattern,
		initializer: ts.Expression,
		name: string,
	): string {
		const expression = this.expression_names.unwrap_transparent_expression(initializer);
		if (ts.isIdentifier(expression)) {
			const source = this.object_sources.get(expression.text);
			if (source === undefined) {
				return '';
			}
			return this.literal_binding_source(binding, source, name);
		}
		if (ts.isObjectLiteralExpression(expression)) {
			return this.literal_binding_source(binding, expression, name);
		}
		return '';
	}

	/** Responsibilities: _literal binding source_. **/
	private literal_binding_source(
		binding: ts.ObjectBindingPattern,
		initializer: ts.ObjectLiteralExpression,
		name: string,
	): string {
		for (const element of binding.elements) {
			if (!ts.isBindingElement(element)) {
				continue;
			}
			if (!ts.isIdentifier(element.name) || element.name.text !== name) {
				continue;
			}
			return this.properties.source(initializer, this.expression_names.static_binding_name(element));
		}
		return '';
	}

	/** Responsibilities: _factory property name_. **/
	private property_name(expression: ts.Expression): string {
		if (ts.isPropertyAccessExpression(expression)) {
			return expression.name.text;
		}
		if (!ts.isElementAccessExpression(expression)) {
			return '';
		}
		const argument = expression.argumentExpression;
		if (argument === undefined) {
			return '';
		}
		return argument.getText().replace(/^['"`]|['"`]$/g, '');
	}

	/** Responsibilities: _binding expression collection_. **/
	private append_binding_expressions(
		binding: ts.ObjectBindingPattern,
		initializer: ts.Expression,
		name: string,
		expressions: Map<string, ts.FunctionLikeDeclarationBase>,
	): void {
		let source = this.expression_names.unwrap_transparent_expression(initializer);
		if (ts.isIdentifier(source)) {
			const object_source = this.object_sources.get(source.text);
			if (object_source === undefined) {
				return;
			}
			source = object_source;
		}
		if (!ts.isObjectLiteralExpression(source)) {
			return;
		}
		for (const [alias_name, expression] of this.properties.binding_expressions(source, binding, name)) {
			expressions.set(alias_name, expression);
		}
	}

	/** Responsibilities: _source property body collection_. **/
	private append_bodies(
		receiver: ts.Expression,
		property_name: string,
		bodies: ts.FunctionLikeDeclarationBase[]
	): void {
		const source = this.expression_names.unwrap_transparent_expression(receiver);
		if (!ts.isIdentifier(source)) {
			return;
		}
		const object = this.object_sources.get(source.text);
		if (object === undefined) {
			return;
		}
		for (const body of this.properties.expressions(object, property_name).values()) {
			bodies.push(body);
		}
	}

	/** Responsibilities: _property body collection_. **/
	private append_property_bodies(
		expression: ts.Expression,
		property_name: string,
		bodies: ts.FunctionLikeDeclarationBase[]
	): void {
		let receiver: ts.Expression;
		if (ts.isPropertyAccessExpression(expression)) {
			receiver = expression.expression;
		} else if (ts.isElementAccessExpression(expression)) {
			receiver = expression.expression;
		} else {
			return;
		}
		this.append_bodies(receiver, property_name, bodies);
	}

	/** Responsibilities: _initialization object factory aliases_. **/
	public constructor(source_file: ts.SourceFile) {
		this.source_file = source_file;
		this.object_source_registry = new TypeScriptFactoryObjectSources(source_file);
		this.object_sources = this.object_source_registry.values();
		this.array_aliases = new TypeScriptFactoryArrayAliases(source_file);
		this.properties = new TypeScriptFactoryObjectProperties(this.object_sources, this.array_aliases);
	}

	/** Responsibilities: _factory expression alias_. **/
	public append_expression(
		declaration: ts.VariableDeclaration,
		name: string,
		expressions: Map<string, ts.FunctionLikeDeclarationBase>,
	): void {
		if (!ts.isObjectBindingPattern(declaration.name)) {
			return;
		}
		if (declaration.initializer === undefined) {
			return;
		}
		this.append_binding_expressions(declaration.name, declaration.initializer, name, expressions);
	}

	/** Responsibilities: _collection object factory names_. **/
	public names(): ReadonlySet<string> {
		const names = new Set<string>();
		for (const declaration of this.variable_declarations()) {
			if (!ts.isObjectBindingPattern(declaration.name)) {
				continue;
			}
			for (const element of declaration.name.elements) {
				if (ts.isBindingElement(element)) {
					this.append_binding_name(element.name, names);
				}
			}
		}
		return names;
	}

	/** Responsibilities: _resolution object factory source_. **/
	public source(declaration: ts.VariableDeclaration, name: string): string {
		if (!ts.isObjectBindingPattern(declaration.name)) {
			return '';
		}
		if (declaration.initializer === undefined) {
			return '';
		}
		return this.binding_source(declaration.name, declaration.initializer, name);
	}

	/** Responsibilities: _object factory property bodies_. **/
	public property_bodies(expression: ts.Expression): readonly ts.FunctionLikeDeclarationBase[] {
		const property_name = this.property_name(expression);
		if (property_name === '') {
			return [];
		}
		const bodies: ts.FunctionLikeDeclarationBase[] = [];
		this.append_property_bodies(expression, property_name, bodies);
		return bodies;
	}
}
