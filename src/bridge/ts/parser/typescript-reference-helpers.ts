import ts from 'typescript';
import { TypeScriptReferenceType } from 'src/parser/ts/typescript-reference-type';
import type { TypeScriptInstanceStore } from 'src/model/protocols';

/** Responsibilities: _resolution TypeScript aliases constructor_. **/
export class TypeScriptReferenceHelpers {
	private readonly reference_type = TypeScriptReferenceType;

	/** Responsibilities: _resolution class name construction_. **/
	private new_expression_name(expression: ts.NewExpression): string {
		if (!ts.isIdentifier(expression.expression)) {
			return '';
		}
		return expression.expression.text;
	}

	/** Responsibilities: _resolution name through configuration_. **/
	private aliased_name(name: string, aliases: Map<string, string>): string {
		const alias = aliases.get(name);
		if (alias === undefined) {
			return name;
		}
		return alias;
	}

	/** Responsibilities: _resolution owner represented new_. **/
	private new_expression_owner(
		expression: ts.NewExpression,
		aliases: Map<string, string>
	): string {
		const name = this.new_expression_name(expression);
		if (name.length === 0) {
			return '';
		}
		return this.aliased_name(name, aliases);
	}

	/** Responsibilities: _resolution referenced expression name_. **/
	public resolved_reference_name(
		type: ts.TypeNode,
		aliases: Map<string, string>
	): string {
		const reference = new this.reference_type(type);
		const name = reference.resolved_name(aliases);
		if (name) {
			return name;
		}
		return '';
	}

	/** Responsibilities: _resolution parameter's declared owner_. **/
	public parameter_owner(
		node: ts.ParameterDeclaration,
		aliases: Map<string, string>
	): string {
		const initializer = node.initializer;
if (initializer !== undefined && ts.isNewExpression(initializer)) {
			return this.new_expression_owner(initializer, aliases);
		}
		if (node.type === undefined) {
			return '';
		}
		return this.resolved_reference_name(node.type, aliases);
	}

	/** Responsibilities: _resolution instance owner represented_. **/
	public new_instance(
		node: ts.VariableDeclaration,
		aliases: Map<string, string>,
		instances: TypeScriptInstanceStore,
		initializer: ts.Expression
	): boolean {
		if (!ts.isNewExpression(initializer)) {
			return false;
		}
		const owner = this.new_expression_owner(initializer, aliases);
		if (!owner) {
			return false;
		}
		instances.add(node.name.getText(node.getSourceFile()), owner, node);
		return true;
	}

}
