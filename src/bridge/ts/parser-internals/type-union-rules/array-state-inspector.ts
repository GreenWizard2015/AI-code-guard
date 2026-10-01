import { TypeScriptArrayCallableDeclarations } from "src/bridge/ts/parser-internals/type-union-rules/array-callable-declarations";
import { TypeScriptCallAliases } from "src/bridge/ts/parser-internals/type-union-rules/typescript-call-aliases";
import { TypeScriptTypeAliases } from "src/typescript-aliases/type-aliases";
import { TypeScriptExpressionNames } from "src/typescript-aliases/typescript-expression-names";
import ts from "typescript";

/** Responsibilities: _array result detection_. **/
export class TypeScriptArrayStateInspector {
	private readonly expression_names = new TypeScriptExpressionNames();
	private readonly array_type_names = new Set(["Array", "ReadonlyArray"]);
	private readonly call_aliases = new TypeScriptCallAliases();
	private readonly type_aliases = new TypeScriptTypeAliases();
	private readonly callable_declarations = new TypeScriptArrayCallableDeclarations();

	/** Responsibilities: _invocation alias name_. **/
	private invocation_name(expression: ts.CallExpression, aliases: ReadonlyMap<string, string>): string {
		const name = this.call_aliases.call_name(expression);
		const resolved = aliases.get(name);
		if (resolved !== undefined) {
			return resolved;
		}
		return name;
	}

	/** Responsibilities: _callable name lookup_. **/
	private indexed_call_name(expression: ts.Expression, aliases: ReadonlyMap<string, string>): string {
		const unwrapped_expression = this.expression_names.unwrap_transparent_expression(expression);
		if (ts.isCallExpression(unwrapped_expression)) {
			return this.invocation_name(unwrapped_expression, aliases);
		}
		if (!ts.isIdentifier(unwrapped_expression)) {
			return "";
		}
		const name = aliases.get(unwrapped_expression.text);
		if (name === undefined) {
			return "";
		}
		return name;
	}

	/** Responsibilities: _classification callable output array_. **/
	private array_type_reference(type: ts.TypeReferenceNode, source_file: ts.SourceFile): boolean {
		let type_name = type.typeName;
		while (ts.isQualifiedName(type_name)) {
			type_name = type_name.right;
		}
		if (!ts.isIdentifier(type_name)) {
			return false;
		}
		if (this.array_type_names.has(type_name.text)) {
			return true;
		}
		this.type_aliases.collect(source_file);
		const resolved = this.type_aliases.resolve(type_name.text);
		return this.array_type_text(resolved, source_file, new Set<string>());
	}

	/** Responsibilities: _nested array type_. **/
	private array_type_text(text: string, source_file: ts.SourceFile, visited: Set<string>): boolean {
		if (visited.has(text)) {
			return false;
		}
		visited.add(text);
		const normalized = text.replace(/^readonly\s+/u, "");
		if (normalized.endsWith("[]") || normalized.startsWith("Array<") || normalized.startsWith("ReadonlyArray<")) {
			return true;
		}
		const readonly_match = /^Readonly<(.+)>$/u.exec(normalized);
		const has_readonly_match = readonly_match !== null;
		if (has_readonly_match && this.array_type_text(readonly_match[1], source_file, visited)) {
			return true;
		}
		const resolved = this.type_aliases.resolve(normalized);
		const type_changed = resolved !== normalized;
		return type_changed && this.array_type_text(resolved, source_file, visited);
	}

	/** Responsibilities: _classification callable output array_. **/
	private array_return_type(callable: ts.FunctionLikeDeclaration): boolean {
		const type = callable.type;
		if (type === undefined) {
			return false;
		}
		if (ts.isArrayTypeNode(type)) {
			return true;
		}
		if (ts.isTypeOperatorNode(type)) {
			if (type.operator === ts.SyntaxKind.ReadonlyKeyword) {
				return ts.isArrayTypeNode(type.type);
			}
		}
		if (!ts.isTypeReferenceNode(type)) {
			return false;
		}
		return this.array_type_reference(type, callable.getSourceFile());
	}

	/** Responsibilities: _collection expressions output callable_. **/
	private returned_expressions(body: ts.Block): ts.Expression[] {
		const returns: ts.Expression[] = [];
		const visit = (node: ts.Node): void => {
			if (ts.isReturnStatement(node)) {
				if (node.expression !== undefined) {
					returns.push(node.expression);
				}
				return;
			}
			if (ts.isFunctionLike(node)) {
				return;
			}
			ts.forEachChild(node, visit);
		};
		visit(body);
		return returns;
	}

	/** Responsibilities: _classification every output array_. **/
	private single_item_returns(callable: ts.FunctionLikeDeclaration): boolean {
		const body = callable.body;
		if (body === undefined) {
			return false;
		}
		if (!ts.isBlock(body)) {
			return this.single_item_array(body);
		}
		const returns = this.returned_expressions(body);
		if (returns.length === 0) {
			return false;
		}
		return returns.every((expression) => this.single_item_array(expression));
	}

	/** Responsibilities: _classification single-item array expression_. **/
	private single_item_array(expression: ts.Expression): boolean {
		const unwrapped_expression = this.expression_names.unwrap_transparent_expression(expression);
		if (!ts.isArrayLiteralExpression(unwrapped_expression)) {
			return false;
		}
		return unwrapped_expression.elements.length <= 1;
	}

	/** Responsibilities: _array access name_. **/
	private at_access_name(node: ts.CallExpression, source_file: ts.SourceFile): string {
		if (!ts.isPropertyAccessExpression(node.expression)) {
			return "";
		}
		if (node.expression.name.text !== "at") {
			return "";
		}
		if (node.arguments.length !== 1) {
			return "";
		}
		const argument = this.expression_names.unwrap_transparent_expression(node.arguments[0]);
		if (!ts.isNumericLiteral(argument)) {
			return "";
		}
		if (argument.text !== "0") {
			return "";
		}
		return this.indexed_call_name(node.expression.expression, this.call_aliases.names(source_file));
	}

	/** Responsibilities: _single-item method detection_. **/
	public single_item_method(node: ts.CallExpression, source_file: ts.SourceFile): boolean {
		const name = this.at_access_name(node, source_file);
		if (name.length === 0) {
			return false;
		}
		const callables = this.callable_declarations.collect(source_file, name);
		return callables.some((callable) => this.single_item_callable(callable));
	}

	/** Responsibilities: _single-item callable detection_. **/
	public single_item_callable(callable: ts.FunctionLikeDeclaration): boolean {
		if (!this.array_return_type(callable)) {
			return false;
		}
		return this.single_item_returns(callable);
	}

	/** Responsibilities: _single-item access detection_. **/
	public single_item_access(node: ts.ElementAccessExpression, source_file: ts.SourceFile): boolean {
		const name = this.indexed_call_name(node.expression, this.call_aliases.names(source_file));
		if (name.length === 0) {
			return false;
		}
		const callables = this.callable_declarations.collect(source_file, name);
		return callables.some((callable) => this.single_item_callable(callable));
	}
}
