import ts from "typescript";
import type { SpreadValueAppender } from "src/protocols";
import { TypeScriptStaticArraySources } from "src/type_script_static_array_sources";
import { TypeScriptStaticArrayValues } from "src/type_script_static_array_values";
import { TypeScriptStaticArrayMethods } from "src/type_script_static_array_methods";
import { TypeScriptExpressionNames } from "src/typescript-aliases/type_script_expression_names";
import { StaticExpressionArray } from "src/static_expression_array";
import type { StaticExpressionArrayContract } from "src/protocols";

/** Responsibilities: _object argument binding collection_, _spread argument extraction_. **/
export class TypeScriptStaticObjectArguments {
	private readonly array_sources: Map<string, StaticExpressionArrayContract>;
	private readonly numeric_sources: Map<string, number>;
	private readonly expression_names: TypeScriptExpressionNames;
	private readonly array_collector: TypeScriptStaticArraySources;
	private readonly array_values: TypeScriptStaticArrayValues;

	/** Responsibilities: _static array declaration collection_. **/
	/** Responsibilities: _field initialization_. **/
	constructor() {
		this.array_sources = new Map<string, StaticExpressionArray>();
		this.numeric_sources = new Map<string, number>();
		this.expression_names = new TypeScriptExpressionNames();
		this.array_collector = new TypeScriptStaticArraySources(
			this.array_sources,
			this.numeric_sources,
			this.expression_names,
		);
		this.array_values = new TypeScriptStaticArrayValues(
			this.array_sources,
			this.numeric_sources,
			new TypeScriptStaticArrayMethods(),
			new TypeScriptExpressionNames(),
		);
	}
	/** Responsibilities: _public operation_. **/
	public append_declaration(node: ts.VariableDeclaration): boolean {
		if (!ts.isIdentifier(node.name)) {
			return false;
		}
		if (node.initializer === undefined) {
			return false;
		}
		return this.array_collector.append_source(node);
	}

	/** Responsibilities: _static array assignment collection_. **/
	public append_assignment(node: ts.BinaryExpression): boolean {
		if (node.operatorToken.kind !== ts.SyntaxKind.EqualsToken) {
			return false;
		}
		if (!ts.isIdentifier(node.left)) {
			return false;
		}
		return this.array_collector.append_assignment(node.left.text, node.right);
	}

	/** Responsibilities: _static spread argument resolution_. **/
	public append_spread(element: ts.SpreadElement, append_value: SpreadValueAppender): boolean {
		const values: ts.Expression[] = [];
		this.array_values.sequence(element.expression).append_to(values);
		let found = false;
		for (const value of values) {
			if (append_value(value)) {
				found = true;
			}
		}
		return found;
	}
}
