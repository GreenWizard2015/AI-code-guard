import type {
	FactoryObjectSourcesContract,
	TypeScriptFactoryArraySourcesContract,
} from "src/contracts/protocols/lint_runtime_protocols";
import { TypeScriptFactoryArrayAlias } from "src/linting/orchestration/runtime/typescript-singleton/factory-arrays/type_script_factory_array_alias";
import { TypeScriptFactoryArraySources } from "src/linting/orchestration/runtime/typescript-singleton/factory-arrays/type_script_factory_array_sources";
import { TypeScriptFactoryObjectSources } from "src/linting/orchestration/runtime/typescript-singleton/type_script_factory_object_sources";
import { TypeScriptExpressionNames } from "src/parser/typescript-aliases/type_script_expression_names";
import type { ExpressionNamesContract } from "src/runtime_protocols";
import type {
	TypeScriptFactoryArrayAliasContract,
	TypeScriptFactoryArrayAliasesContract,
} from "src/typescript_runtime_protocols";
import ts from "typescript";

/** Responsibilities: _array factory alias collection_, _alias identity lookup_. **/
export class TypeScriptFactoryArrayAliases implements TypeScriptFactoryArrayAliasesContract {
	private readonly _source_file: ts.SourceFile;
	private readonly _expression_names: ExpressionNamesContract;
	private readonly _sources: TypeScriptFactoryArraySourcesContract;
	private readonly _object_sources: FactoryObjectSourcesContract;
	private readonly _aliases: Map<string, TypeScriptFactoryArrayAliasContract>;

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

	/** Responsibilities: _nested array alias names_. **/
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

	/** Responsibilities: _array alias collection initialization_. **/
	public constructor(source_file: ts.SourceFile) {
		this._source_file = source_file;
		this._expression_names = new TypeScriptExpressionNames();
		this._object_sources = new TypeScriptFactoryObjectSources(source_file);
		this._sources = new TypeScriptFactoryArraySources(source_file, this._object_sources);
		this._aliases = new Map();
	}

	/** Responsibilities: _array alias lookup_. **/
	public alias(name: string): TypeScriptFactoryArrayAliasContract {
		const cached = this._aliases.get(name);
		if (cached !== undefined) {
			return cached;
		}
		const alias = new TypeScriptFactoryArrayAlias(name, this._expression_names, this._sources, this._object_sources);
		this._aliases.set(name, alias);
		return alias;
	}

	/** Responsibilities: _array factory name collection_. **/
	public names(): ReadonlySet<string> {
		const names = new Set<string>();
		for (const declaration of this.variable_declarations()) {
			const binding_data = this._sources.binding_data(declaration);
			for (const element of binding_data.elements) {
				this.append_binding_name(element.name, names);
			}
		}
		return names;
	}
}
