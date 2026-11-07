import type { FactoryObjectSourcesContract } from "src/contracts/protocols/lint_runtime_protocols";
import { TypeScriptFactoryArrayAliases } from "src/linting/orchestration/runtime/typescript-singleton/factory-arrays/type_script_factory_array_aliases";
import { TypeScriptFactoryObjectBinding } from "src/linting/orchestration/runtime/typescript-singleton/type_script_factory_object_binding";
import { TypeScriptFactoryObjectProperties } from "src/linting/orchestration/runtime/typescript-singleton/type_script_factory_object_properties";
import { TypeScriptFactoryObjectSources } from "src/linting/orchestration/runtime/typescript-singleton/type_script_factory_object_sources";
import { TypeScriptFactoryPropertyBodies } from "src/linting/orchestration/runtime/typescript-singleton/type_script_factory_property_bodies";
import { TypeScriptExpressionNames } from "src/parser/typescript-aliases/type_script_expression_names";
import type { ExpressionNamesContract } from "src/runtime_protocols";
import type {
	TypeScriptFactoryArrayAliasesContract,
	TypeScriptFactoryObjectAliasesContract,
	TypeScriptFactoryObjectPropertiesContract,
} from "src/typescript_runtime_protocols";
import ts from "typescript";

/** Responsibilities: _object factory alias indexing_, _callable body lookup_. **/
export class TypeScriptFactoryObjectAliases implements TypeScriptFactoryObjectAliasesContract {
	private readonly _expression_names: ExpressionNamesContract;
	private readonly _source_file: ts.SourceFile;
	private readonly _object_source_registry: FactoryObjectSourcesContract;
	private readonly _object_sources: Map<string, ts.ObjectLiteralExpression>;
	private readonly _properties: TypeScriptFactoryObjectPropertiesContract;
	private readonly _array_aliases: TypeScriptFactoryArrayAliasesContract;

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
		visit(this._source_file);
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

	/** Responsibilities: _initialization object factory aliases_. **/
	public constructor(source_file: ts.SourceFile) {
		this._expression_names = new TypeScriptExpressionNames();
		this._source_file = source_file;
		this._object_source_registry = new TypeScriptFactoryObjectSources(source_file);
		this._object_sources = this._object_source_registry.values();
		this._array_aliases = new TypeScriptFactoryArrayAliases(source_file);
		this._properties = new TypeScriptFactoryObjectProperties(this._object_sources, this._array_aliases);
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
		const binding = new TypeScriptFactoryObjectBinding({
			binding: declaration.name,
			initializer: declaration.initializer,
			name,
			expression_names: this._expression_names,
			object_sources: this._object_sources,
			properties: this._properties,
		});
		binding.append_expressions(expressions);
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
			return "";
		}
		if (declaration.initializer === undefined) {
			return "";
		}
		const binding = new TypeScriptFactoryObjectBinding({
			binding: declaration.name,
			initializer: declaration.initializer,
			name,
			expression_names: this._expression_names,
			object_sources: this._object_sources,
			properties: this._properties,
		});
		return binding.source();
	}

	/** Responsibilities: _object factory property bodies_. **/
	public property_bodies(expression: ts.Expression): readonly ts.FunctionLikeDeclarationBase[] {
		const property_bodies = new TypeScriptFactoryPropertyBodies(
			expression,
			this._expression_names,
			this._object_sources,
			this._properties,
		);
		return property_bodies.bodies();
	}
}
