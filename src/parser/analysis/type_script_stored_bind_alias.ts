import ts from "typescript";
import type { StaticValueResolver, TypeScriptMemberAliasesContract } from "src/protocols";

/** Responsibilities: _alias targets_, _member chains_. **/
export class TypeScriptStoredBindAlias {
	private readonly bind_name = "bind";

	/** Responsibilities: _static member name_. **/
	private static_member_name(expression: ts.Expression): string {
		if (ts.isPropertyAccessExpression(expression)) {
			return expression.name.text;
		}
		if (!ts.isElementAccessExpression(expression)) {
			return "";
		}
		const argument = expression.argumentExpression;
		if (ts.isStringLiteral(argument) || ts.isNoSubstitutionTemplateLiteral(argument)) {
			return argument.text;
		}
		return "";
	}

	/** Responsibilities: _member alias property_. **/
	private member_alias_property(
		expression: ts.Expression,
		node: ts.Node,
		name: string,
		member_aliases: TypeScriptMemberAliasesContract,
	): boolean {
		if (member_aliases.property(expression, node, name)) {
			return true;
		}
		if (!ts.isIdentifier(expression)) {
			return false;
		}
		return this.alias_declaration(node.getSourceFile(), expression.text, name);
	}

	/** Responsibilities: _variable alias matching_. **/
	private variable_alias(node: ts.Node, expression: string, name: string): boolean {
		if (!ts.isVariableDeclaration(node)) {
			return false;
		}
		if (!ts.isIdentifier(node.name)) {
			return false;
		}
		if (node.name.text !== expression) {
			return false;
		}
		const initializer = node.initializer;
		if (initializer === undefined) {
			return false;
		}
		return this.static_member_name(initializer) === name;
	}

	/** Responsibilities: _source alias lookup_. **/
	private alias_declaration(node: ts.Node, expression: string, name: string): boolean {
		if (this.variable_alias(node, expression, name)) {
			return true;
		}
		let found = false;
		node.forEachChild((child) => {
			if (!found && this.alias_declaration(child, expression, name)) {
				found = true;
			}
		});
		return found;
	}

	/** Responsibilities: _bind member classification_. **/
	private bind_member(
		expression: ts.Expression,
		node: ts.Node,
		member_aliases: TypeScriptMemberAliasesContract,
		static_value: StaticValueResolver,
	): boolean {
		const current = expression;
		if (ts.isIdentifier(current)) {
			return this.member_alias_property(current, node, this.bind_name, member_aliases);
		}
		if (ts.isPropertyAccessExpression(current)) {
			return current.name.text === this.bind_name;
		}
		if (!ts.isElementAccessExpression(current)) {
			return false;
		}
		if (current.argumentExpression === undefined) {
			return false;
		}
		return static_value(current.argumentExpression, node) === this.bind_name;
	}

	/** Responsibilities: _element member chain resolution_. **/
	private element_member_chain(expression: ts.ElementAccessExpression): string[] {
		const argument = expression.argumentExpression;
		if (!ts.isStringLiteral(argument) && !ts.isNoSubstitutionTemplateLiteral(argument)) {
			return [];
		}
		const chain = this.static_member_chain(expression.expression);
		chain.push(argument.text);
		return chain;
	}

	/** Responsibilities: _named member chain resolution_. **/
	private named_member_chain(expression: ts.PropertyAccessExpression): string[] {
		const chain = this.static_member_chain(expression.expression);
		chain.push(expression.name.text);
		return chain;
	}

	/** Responsibilities: _static member chain resolution_. **/
	private static_member_chain(expression: ts.Expression): string[] {
		if (ts.isIdentifier(expression)) {
			return [expression.text];
		}
		if (ts.isPropertyAccessExpression(expression)) {
			return this.named_member_chain(expression);
		}
		if (!ts.isElementAccessExpression(expression)) {
			return [];
		}
		return this.element_member_chain(expression);
	}

	/** Responsibilities: _Function bind invocation_. **/
	private function_bind_call(expression: ts.Expression): boolean {
		if (!ts.isPropertyAccessExpression(expression)) {
			return false;
		}
		if (expression.name.text !== "call") {
			return false;
		}
		return this.static_member_chain(expression.expression).join(".") === "Function.prototype.bind";
	}

	/** Responsibilities: _bind member aliases_. **/
	private stored_member(
		member: ts.Expression,
		node: ts.Node,
		member_aliases: TypeScriptMemberAliasesContract,
	): boolean {
		if (ts.isIdentifier(member)) {
			return this.member_alias_property(member, node, this.bind_name, member_aliases);
		}
		if (ts.isPropertyAccessExpression(member)) {
			if (member.name.text !== this.bind_name) {
				return this.member_alias_property(member.expression, node, member.name.text, member_aliases);
			}
			return true;
		}
		if (ts.isElementAccessExpression(member)) {
			return true;
		}
		return false;
	}

	/** Responsibilities: _member alias state_. **/
	private stored_forwarding(
		expression: ts.Expression,
		node: ts.Node,
		member_aliases: TypeScriptMemberAliasesContract,
	): boolean {
		if (!ts.isPropertyAccessExpression(expression)) {
			return false;
		}
		if (expression.name.text !== "call" && expression.name.text !== "apply") {
			return false;
		}
		return this.stored_member(expression.expression, node, member_aliases);
	}

	/** Responsibilities: _bind target boundary_. **/
	public target_member(expression: ts.Expression, node: ts.CallExpression): boolean {
		if (!ts.isPropertyAccessExpression(expression)) {
			return false;
		}
		if (expression.name.text !== this.bind_name || node.arguments.length === 0) {
			return false;
		}
		const context = node.arguments[0];
		return !ts.isObjectLiteralExpression(context) && !ts.isArrayLiteralExpression(context);
	}

	/** Responsibilities: _bind invocation classification_. **/
	public matches(
		node: ts.Node,
		expression: ts.Expression,
		member_aliases: TypeScriptMemberAliasesContract,
		static_value: StaticValueResolver,
	): boolean {
		if (!ts.isCallExpression(node)) {
			return false;
		}
		if (this.bind_member(expression, node, member_aliases, static_value)) {
			return true;
		}
		if (this.function_bind_call(node.expression)) {
			return true;
		}
		return this.stored_forwarding(node.expression, node, member_aliases);
	}
}
