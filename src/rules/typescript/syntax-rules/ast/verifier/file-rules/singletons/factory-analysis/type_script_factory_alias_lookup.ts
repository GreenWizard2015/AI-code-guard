import type { TypeScriptFactoryAliasLookupOptions } from "src/contracts/protocols/lint_runtime_protocols";
import type { ExpressionNamesContract } from "src/runtime_protocols";
import type {
	TypeScriptFactoryArrayAliasesContract,
	TypeScriptFactoryObjectAliasesContract,
} from "src/typescript_runtime_protocols";
import ts from "typescript";

/** Responsibilities: _factory alias source resolution_, _inline factory body collection_. **/
export class TypeScriptFactoryAliasLookup {
	private readonly _array_aliases: TypeScriptFactoryArrayAliasesContract;
	private readonly _expression_names: ExpressionNamesContract;
	private readonly _name: string;
	private readonly _object_aliases: TypeScriptFactoryObjectAliasesContract;

	/** Responsibilities: _factory alias lookup initialization_. **/
	public constructor(options: TypeScriptFactoryAliasLookupOptions) {
		this._name = options.name;
		this._expression_names = options.expression_names;
		this._object_aliases = options.object_aliases;
		this._array_aliases = options.array_aliases;
	}

	/** Responsibilities: _factory source resolution_. **/
	public source(declaration: ts.VariableDeclaration): string {
		if (declaration.initializer === undefined) {
			return "";
		}
		const initializer = this._expression_names.unwrap_transparent_expression(declaration.initializer);
		if (ts.isIdentifier(declaration.name) && declaration.name.text === this._name && ts.isIdentifier(initializer)) {
			return initializer.text;
		}
		const object_source = this._object_aliases.source(declaration, this._name);
		if (object_source !== "") {
			return object_source;
		}
		return this._array_aliases.alias(this._name).source(declaration);
	}

	/** Responsibilities: _inline factory body collection_. **/
	public append_body(declaration: ts.VariableDeclaration, bodies: Map<string, ts.FunctionLikeDeclarationBase>): void {
		this._object_aliases.append_expression(declaration, this._name, bodies);
		for (const expression of this._array_aliases.alias(this._name).expressions(declaration).values()) {
			bodies.set(this._name, expression);
		}
	}
}
