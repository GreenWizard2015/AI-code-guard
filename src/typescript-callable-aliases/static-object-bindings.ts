import ts from "typescript";
import { TypeScriptExpressionAliases } from "src/typescript-aliases/typescript-expression-aliases";
import { TypeScriptStaticObjectProperties } from "src/typescript-callable-aliases/static-object-property-resolver";
import { TypeScriptStaticObjectSources } from "src/typescript-callable-aliases/static-object-sources";
import { TypeScriptStaticObjectArguments } from "src/typescript-callable-aliases/static-object-arguments";

/** Responsibilities: _static object alias collection_. **/
export class TypeScriptStaticObjectBindings {
	private readonly expression_aliases = new TypeScriptExpressionAliases("");
	private readonly arguments_source = new TypeScriptStaticObjectArguments();
	private readonly source_collector = new TypeScriptStaticObjectSources(this.arguments_source);

	/** Responsibilities: _named object source_. **/
	private append_source_value(
		objects: Map<string, ts.ObjectLiteralExpression>,
		name: string,
		initializer: ts.Expression,
	): void {
		if (this.source_collector.append_source(objects, name, initializer)) {
			return;
		}
		const current = this.expression_aliases.unwrapped(initializer);
		if (!ts.isIdentifier(current)) {
			return;
		}
		const object = objects.get(current.text);
		if (object !== undefined) {
			objects.set(name, object);
		}
	}

	/** Responsibilities: _named object source collection_. **/
	public append_named_source(objects: Map<string, ts.ObjectLiteralExpression>, node: ts.VariableDeclaration): void {
		if (!ts.isIdentifier(node.name) || node.initializer === undefined) {
			return;
		}
		this.append_source_value(objects, node.name.text, node.initializer);
	}

	/** Responsibilities: _object declaration collection_. **/
	public append(
		values: Map<string, string>,
		objects: Map<string, ts.ObjectLiteralExpression>,
		node: ts.VariableDeclaration,
	): boolean {
		let changed = this.arguments_source.append_declaration(node);
		if (ts.isIdentifier(node.name)) {
			this.append_named_source(objects, node);
			return changed;
		}
		if (node.initializer === undefined) {
			return false;
		}
		const properties = new TypeScriptStaticObjectProperties(values, objects, this.arguments_source);
		if (properties.append_binding(node.name, node.initializer)) {
			changed = true;
		}
		return changed;
	}

	/** Responsibilities: _static object assignment arguments_. **/
	public append_assignment(node: ts.BinaryExpression): boolean {
		if (node.operatorToken.kind !== ts.SyntaxKind.EqualsToken || !ts.isIdentifier(node.left)) {
			return false;
		}
		return this.arguments_source.append_assignment(node);
	}
}
