import ts from "typescript";

/** Responsibilities: _proxy argument matching_, _proxy parameter extraction_. **/
export class ProxyArgumentMapper {
	private readonly _callable_candidate: ts.Node;
	private readonly _proxy_invocation: ts.Node;

	/** Responsibilities: _proxy argument insertion_. **/
	private append_argument(argument: ts.Expression, arguments_list: ts.Expression[]): boolean {
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

	/** Responsibilities: _proxy argument expansion_. **/
	private append_expanded_arguments(callable_invocation: ts.Node, arguments_list: ts.Expression[]): boolean {
		let provided_arguments: readonly ts.Expression[] = [];
		if (ts.isCallExpression(callable_invocation)) {
			provided_arguments = callable_invocation.arguments;
		} else if (ts.isNewExpression(callable_invocation)) {
			if (callable_invocation.arguments === undefined) {
				return true;
			}
			provided_arguments = callable_invocation.arguments;
		} else {
			return false;
		}
		for (const argument of provided_arguments) {
			if (!this.append_argument(argument, arguments_list)) {
				return false;
			}
		}
		return true;
	}

	/** Responsibilities: _proxy argument name extraction_. **/
	private argument_names(arguments_list: readonly ts.Expression[]): string[] {
		const names: string[] = [];
		for (let argument of arguments_list) {
			while (ts.isPropertyAccessExpression(argument)) {
				argument = argument.expression;
			}
			if (!ts.isIdentifier(argument)) {
				return [];
			}
			names.push(argument.text);
		}
		return names;
	}

	/** Responsibilities: _proxy argument-to-parameter matching_. **/
	/** Responsibilities: _proxy parameter collection_. **/
	public constructor(callable_candidate: ts.Node, proxy_invocation: ts.Node) {
		this._callable_candidate = callable_candidate;
		this._proxy_invocation = proxy_invocation;
	}

	/** Responsibilities: _parameter name collection_. **/
	public parameter_names(): readonly string[] {
		if (!ts.isFunctionLike(this._callable_candidate)) {
			return [];
		}
		const identifiers = this._callable_candidate.parameters.map((parameter) => parameter.name).filter(ts.isIdentifier);
		if (identifiers.length !== this._callable_candidate.parameters.length) {
			return [];
		}
		return identifiers.map((identifier) => identifier.text);
	}

	/** Responsibilities: _proxy argument-to-parameter matching_. **/
	public matching_arguments(parameters: readonly string[]): boolean {
		const arguments_list: ts.Expression[] = [];
		if (!this.append_expanded_arguments(this._proxy_invocation, arguments_list)) {
			return false;
		}
		if (arguments_list.length !== parameters.length) {
			return false;
		}
		const names = this.argument_names(arguments_list);
		if (names.length !== parameters.length) {
			return false;
		}
		const sorted_parameters = parameters.slice();
		sorted_parameters.sort();
		names.sort();
		return names.every((name, index) => name === sorted_parameters[index]);
	}
}
