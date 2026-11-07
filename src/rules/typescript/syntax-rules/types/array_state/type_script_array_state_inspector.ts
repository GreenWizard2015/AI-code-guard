import type { ArrayStateInspectorContract, CallAliasesContract, ExpressionNamesContract } from "src/runtime_protocols";
import type { TypeScriptArrayCallableDeclarationsContract } from "src/typescript_runtime_protocols";
import ts from "typescript";

/** Responsibilities: _array results_, _callable resolution_. **/
export class TypeScriptArrayStateInspector implements ArrayStateInspectorContract {
	private readonly _expression_names: ExpressionNamesContract;
	private readonly _call_aliases: CallAliasesContract;
	private readonly _callable_declarations: TypeScriptArrayCallableDeclarationsContract;

	/** Responsibilities: _invocation alias name_. **/
	private invocation_name(expression: ts.CallExpression, aliases: ReadonlyMap<string, string>): string {
		const name = this._call_aliases.call_name(expression);
		const resolved = aliases.get(name);
		if (resolved !== undefined) {
			return resolved;
		}
		return name;
	}

	/** Responsibilities: _callable name lookup_. **/
	private indexed_call_name(expression: ts.Expression, aliases: ReadonlyMap<string, string>): string {
		const unwrapped_expression = this._expression_names.unwrap_transparent_expression(expression);
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

	/** Responsibilities: _zero-index array access_. **/
	private zero_index_access(array_access_call: ts.CallExpression): boolean {
		if (!ts.isPropertyAccessExpression(array_access_call.expression)) {
			return false;
		}
		if (array_access_call.expression.name.text !== "at" || array_access_call.arguments.length !== 1) {
			return false;
		}
		const argument_node = array_access_call.arguments.at(0);
		if (argument_node === undefined) {
			return false;
		}
		const argument = this._expression_names.unwrap_transparent_expression(argument_node);
		return ts.isNumericLiteral(argument) && argument.text === "0";
	}

	/** Responsibilities: _array access callable name_. **/
	private at_access_name(array_access_call: ts.CallExpression, method_source: ts.SourceFile): string {
		if (!this.zero_index_access(array_access_call)) {
			return "";
		}
		const expression = array_access_call.expression;
		if (!ts.isPropertyAccessExpression(expression)) {
			return "";
		}
		return this.indexed_call_name(expression.expression, this._call_aliases.names(method_source));
	}

	/** Responsibilities: _single-item binding classification_. **/
	private single_element_binding(binding_pattern: ts.ArrayBindingPattern): boolean {
		if (binding_pattern.elements.length !== 1) {
			return false;
		}
		const element = binding_pattern.elements.at(0);
		if (element === undefined || ts.isOmittedExpression(element)) {
			return false;
		}
		return element.dotDotDotToken === undefined;
	}

	/** Responsibilities: _array state composition_. **/
	public constructor(
		expression_names: ExpressionNamesContract,
		call_aliases: CallAliasesContract,
		callable_declarations: TypeScriptArrayCallableDeclarationsContract,
	) {
		this._expression_names = expression_names;
		this._call_aliases = call_aliases;
		this._callable_declarations = callable_declarations;
	}

	/** Responsibilities: _single-item array classification_. **/
	public single_item_expression(call_expression: ts.Expression, analyzed_file: ts.SourceFile): boolean {
		const name = this.indexed_call_name(call_expression, this._call_aliases.names(analyzed_file));
		if (name.length === 0) {
			return false;
		}
		const callables = this._callable_declarations.collect_index(analyzed_file).get(name);
		if (callables === undefined) {
			return false;
		}
		return callables.some((callable) => this._callable_declarations.single_item_callable(callable));
	}

	/** Responsibilities: _single-item method detection_. **/
	public single_item_method(array_method_call: ts.CallExpression, method_source: ts.SourceFile): boolean {
		const name = this.at_access_name(array_method_call, method_source);
		if (name.length === 0) {
			return false;
		}
		const callables = this._callable_declarations.collect_index(method_source).get(name);
		if (callables === undefined) {
			return false;
		}
		return callables.some((callable) => this._callable_declarations.single_item_callable(callable));
	}

	/** Responsibilities: _single-item result binding detection_. **/
	public single_item_binding(binding_pattern: ts.ArrayBindingPattern, binding_source: ts.SourceFile): boolean {
		if (this.single_element_binding(binding_pattern)) {
			return true;
		}
		const has_indexed_binding = binding_pattern.elements.some(
			(element) => !ts.isOmittedExpression(element) && element.dotDotDotToken === undefined,
		);
		if (!has_indexed_binding) {
			return false;
		}
		const declaration = binding_pattern.parent;
		if (!ts.isVariableDeclaration(declaration) || declaration.initializer === undefined) {
			return false;
		}
		return this.single_item_expression(declaration.initializer, binding_source);
	}
}
