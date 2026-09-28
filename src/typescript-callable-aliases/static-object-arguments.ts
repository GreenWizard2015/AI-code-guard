import ts from 'typescript';
import { TypeScriptStaticArraySources } from 'src/typescript-callable-aliases/static-array/typescript-static-array-sources';
import { TypeScriptStaticArrayValues } from 'src/typescript-callable-aliases/static-array/typescript-static-array-value-resolver';

/** Responsibilities: _static object invocation arguments_. **/
export class TypeScriptStaticObjectArguments {
	private readonly array_sources = new Map<string, readonly ts.Expression[]>();
	private readonly numeric_sources = new Map<string, number>();
	private readonly array_collector = new TypeScriptStaticArraySources(this.array_sources, this.numeric_sources);
	private readonly array_values = new TypeScriptStaticArrayValues(this.array_sources, this.numeric_sources);

	/** Responsibilities: _static array declaration collection_. **/
	public append_declaration(node: ts.VariableDeclaration): boolean {
		if (!ts.isIdentifier(node.name) || node.initializer === undefined) {
			return false;
		}
		return this.array_collector.append_source(node);
	}

	/** Responsibilities: _static array assignment collection_. **/
	public append_assignment(node: ts.BinaryExpression): boolean {
		if (node.operatorToken.kind !== ts.SyntaxKind.EqualsToken || !ts.isIdentifier(node.left)) {
			return false;
		}
		return this.array_collector.append_assignment(node.left.text, node.right);
	}

	/** Responsibilities: _static spread argument resolution_. **/
	public append_spread(
		element: ts.SpreadElement,
		append_value: (expression: ts.Expression) => boolean
	): boolean {
		let found = false;
		for (const value of this.array_values.values(element.expression)) {
			if (append_value(value)) {
				found = true;
			}
		}
		return found;
	}
}
