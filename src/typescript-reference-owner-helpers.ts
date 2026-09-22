import ts from 'typescript';
import type { TypeScriptInstanceStore } from 'src/model/protocols';
import type { PropertyOwnerCallbacks } from 'src/protocols';

/** Responsibilities: _resolution TypeScript owners identifiers_. **/
export class TypeScriptReferenceOwnerHelpers {
	private readonly this_keyword = ts.SyntaxKind.ThisKeyword;
	private readonly aliases: Map<string, string>;
	private readonly instances: TypeScriptInstanceStore;
	private readonly callbacks: PropertyOwnerCallbacks;

	/** Responsibilities: _resolution owner non-constructor expression_. **/
	private non_new_owner(
		expression: ts.Expression,
		current_owner: string
	): string {
		if (ts.isIdentifier(expression)) {
			return this.identifier_owner(expression, this.instances);
		}
		if (expression.kind === this.this_keyword) {
			return current_owner;
		}
		return this.member_owner(expression, current_owner);
	}

	/** Responsibilities: _resolution owner member access_. **/
	private member_owner(
		expression: ts.Expression,
		current_owner: string
	): string {
		if (ts.isCallExpression(expression)) {
			return this.callbacks.call_owner(expression.expression, current_owner);
		}
		if (ts.isPropertyAccessExpression(expression)) {
			return this.callbacks.method_owner(expression, current_owner);
		}
		return '';
	}

	/** Responsibilities: _initialization aliases instances property_. **/
	constructor(
		aliases: Map<string, string>,
		instances: TypeScriptInstanceStore,
		callbacks: PropertyOwnerCallbacks
	) {
		this.aliases = aliases;
		this.instances = instances;
		this.callbacks = callbacks;
	}

	/** Responsibilities: _resolution owner represented new_. **/
	public new_expression_owner(
		expression: ts.NewExpression,
		aliases: Map<string, string>
	): string {
		if (!ts.isIdentifier(expression.expression)) {
			return '';
		}
		const name = expression.expression.text;
		const alias = aliases.get(name);
		if (alias === undefined) {
			return name;
		}
		return alias;
	}

	/** Responsibilities: _resolution identifier owner through_. **/
	public identifier_owner(expression: ts.Identifier, instances: TypeScriptInstanceStore): string {
		const owner = instances.instance_owner(expression.text, expression);
		if (owner === undefined) {
			return expression.text;
		}
		return owner;
	}

	/** Responsibilities: _resolution base owner property_. **/
	public property_base_owner(
		expression: ts.Expression,
		current_owner: string
	): string {
		if (ts.isNewExpression(expression)) {
			return this.new_expression_owner(expression, this.aliases);
		}
		return this.non_new_owner(expression, current_owner);
	}
}
