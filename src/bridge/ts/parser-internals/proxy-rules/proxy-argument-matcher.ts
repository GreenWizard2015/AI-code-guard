import ts from 'typescript';

/** Responsibilities: _proxy argument matching_. **/
export class ProxyArgumentMatcher {
	private readonly empty_arguments: readonly ts.Expression[] = [];

	/** Responsibilities: _argument spread expansion_. **/
	private append_argument(arguments_list: ts.Expression[], argument: ts.Expression): boolean {
		if (!ts.isSpreadElement(argument)) {
			arguments_list.push(argument);
			return true;
		}
		if (!ts.isArrayLiteralExpression(argument.expression)) {
			return false;
		}
		arguments_list.push(...argument.expression.elements);
		return true;
	}

	/** Responsibilities: _expanded argument collection_. **/
	private collect_arguments(call_arguments: ts.NodeArray<ts.Expression>): readonly ts.Expression[] {
		if (call_arguments.length === 0) {
			return this.empty_arguments;
		}
		const arguments_list: ts.Expression[] = [];
		for (const argument of call_arguments) {
			if (!this.append_argument(arguments_list, argument)) {
				return this.empty_arguments;
			}
		}
		return arguments_list;
	}

	/** Responsibilities: _argument collection_. **/
	private call_arguments(call: ts.Node): readonly ts.Expression[] {
		if (ts.isCallExpression(call)) {
			return this.collect_arguments(call.arguments);
		}
		if (ts.isNewExpression(call)) {
			if (call.arguments === undefined) {
				return this.empty_arguments;
			}
			return this.collect_arguments(call.arguments);
		}
		return this.empty_arguments;
	}

	/** Responsibilities: _spread classification_. **/
	private has_unsupported_spread(call: ts.Node): boolean {
		if (ts.isCallExpression(call)) {
			return this.unsupported_spread_arguments(call.arguments);
		}
		if (ts.isNewExpression(call)) {
			if (call.arguments === undefined) {
				return false;
			}
			return this.unsupported_spread_arguments(call.arguments);
		}
		return false;
	}

	/** Responsibilities: _unsupported spread argument classification_. **/
	private unsupported_spread_arguments(arguments_list: ts.NodeArray<ts.Expression>): boolean {
		return arguments_list.some(argument => {
			if (!ts.isSpreadElement(argument)) {
				return false;
			}
			return !ts.isArrayLiteralExpression(argument.expression);
		});
	}

	/** Responsibilities: _argument root resolution_. **/
	private argument_root(node: ts.Expression): string {
		let current = node;
		while (ts.isPropertyAccessExpression(current)) {
			current = current.expression;
		}
		if (ts.isIdentifier(current)) {
			return current.text;
		}
		return '';
	}

	/** Responsibilities: _argument name collection_. **/
	private identifier_names(nodes: readonly ts.Expression[]): string[] {
		const names: string[] = [];
		for (const node of nodes) {
			const name = this.argument_root(node);
			if (name.length === 0) {
				return [];
			}
			names.push(name);
		}
		return names;
	}

	/** Responsibilities: _argument names_. **/
	public names(call: ts.Node): string[] {
		return this.identifier_names(this.call_arguments(call));
	}

	/** Responsibilities: _argument matching_. **/
	public matches(call: ts.Node, parameters: readonly string[]): boolean {
		if (this.has_unsupported_spread(call)) {
			return false;
		}
		const arguments_list = this.call_arguments(call);
		if (arguments_list.length !== parameters.length) {
			return false;
		}
		const argument_names = this.names(call);
		if (argument_names.length !== parameters.length) {
			return false;
		}
		const parameter_names_sorted = [...parameters].sort();
		argument_names.sort();
		return parameter_names_sorted.every((parameter, index) => parameter === argument_names[index]);
	}
}
