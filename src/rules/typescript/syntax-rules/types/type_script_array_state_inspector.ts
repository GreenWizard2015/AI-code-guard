import { TypeScriptArrayCallableDeclarations } from "src/rules/typescript/syntax-rules/types/type_script_array_callable_declarations";
import { TypeScriptTypeAliases } from "src/typescript-aliases/type_script_type_aliases";
import type {
	ArrayStateInspectorContract,
	CallAliasesContract,
	ExpressionNamesContract,
	TypeScriptTypeAliasesContract,
} from "src/protocols";
import { READONLY_BUILTIN_TYPES, TYPESCRIPT_ARRAY_TYPE_NAME } from "src/metrics/constants";
import ts from "typescript";

/** Responsibilities: _array results_, _callable resolution_. **/
export class TypeScriptArrayStateInspector implements ArrayStateInspectorContract {
	private readonly expression_names: ExpressionNamesContract;
	private readonly array_type_names: Set<string>;
	private readonly call_aliases: CallAliasesContract;
	private readonly type_aliases: WeakMap<ts.SourceFile, TypeScriptTypeAliasesContract>;
	private readonly callable_declarations: TypeScriptArrayCallableDeclarations;
	private readonly callable_results: WeakMap<ts.FunctionLikeDeclaration, boolean>;

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

	/** Responsibilities: _source type alias lookup_. **/
	private source_type_aliases(source_file: ts.SourceFile): TypeScriptTypeAliasesContract {
		let aliases = this.type_aliases.get(source_file);
		if (aliases === undefined) {
			aliases = new TypeScriptTypeAliases();
			aliases.collect(source_file);
			this.type_aliases.set(source_file, aliases);
		}
		return aliases;
	}

	/** Responsibilities: _array type reference classification_. **/
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
		if (type_name.text.endsWith("Array") && READONLY_BUILTIN_TYPES.has(type_name.text)) {
			return true;
		}
		const aliases = this.source_type_aliases(source_file);
		const resolved = aliases.resolve(type_name.text);
		return this.array_type_text(resolved, aliases, new Set<string>());
	}

	/** Responsibilities: _nested array type_. **/
	private array_type_text(text: string, aliases: TypeScriptTypeAliasesContract, visited: Set<string>): boolean {
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
		if (has_readonly_match && this.array_type_text(readonly_match[1], aliases, visited)) {
			return true;
		}
		const resolved = aliases.resolve(normalized);
		const type_changed = resolved !== normalized;
		return type_changed && this.array_type_text(resolved, aliases, visited);
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

	/** Responsibilities: _single item callable classification_. **/
	private classify_callable(callable: ts.FunctionLikeDeclaration): boolean {
		if (!this.array_return_type(callable)) {
			return false;
		}
		return this.single_item_returns(callable);
	}

	/** Responsibilities: _array state composition_. **/
	public constructor(expression_names: ExpressionNamesContract, call_aliases: CallAliasesContract) {
		this.array_type_names = new Set([TYPESCRIPT_ARRAY_TYPE_NAME]);
		this.type_aliases = new WeakMap<ts.SourceFile, TypeScriptTypeAliases>();
		this.callable_declarations = new TypeScriptArrayCallableDeclarations();
		this.callable_results = new WeakMap<ts.FunctionLikeDeclaration, boolean>();
		this.expression_names = expression_names;
		this.call_aliases = call_aliases;
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

	/** Responsibilities: _cached single-item callable classification_. **/
	public single_item_callable(callable: ts.FunctionLikeDeclaration): boolean {
		const cached = this.callable_results.get(callable);
		if (cached !== undefined) {
			return cached;
		}
		const result = this.classify_callable(callable);
		this.callable_results.set(callable, result);
		return result;
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
