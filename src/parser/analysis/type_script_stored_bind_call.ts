import type {
	StoredAliasDeclarationIndexContract,
	TypeScriptStoredBindCallContract,
	TypeScriptStoredBindCallOptions,
} from "src/parser/analysis/protocols";
import type { CallableStaticValueResolver } from "src/runtime_types";
import type { TypeScriptMemberAliasesContract } from "src/typescript_runtime_protocols";
import ts from "typescript";

/** Responsibilities: _bind invocation analysis_, _member classification_. **/
export class TypeScriptStoredBindCall implements TypeScriptStoredBindCallContract {
	private readonly _alias_declarations: StoredAliasDeclarationIndexContract;
	private readonly _bind_name: string;
	private readonly _expression: ts.Expression;
	private readonly _member_aliases: TypeScriptMemberAliasesContract;
	private readonly _node: ts.CallExpression;
	private readonly _static_value: CallableStaticValueResolver;

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
	private function_bind_call(): boolean {
		const call_target = this._node.expression;
		if (!ts.isPropertyAccessExpression(call_target)) {
			return false;
		}
		if (call_target.name.text !== "call") {
			return false;
		}
		return this.static_member_chain(call_target.expression).join(".") === "Function.prototype.bind";
	}

	/** Responsibilities: _member alias forwarding_. **/
	private stored_forwarding(): boolean {
		const call_target = this._node.expression;
		if (!ts.isPropertyAccessExpression(call_target)) {
			return false;
		}
		if (call_target.name.text !== "call" && call_target.name.text !== "apply") {
			return false;
		}
		return this.stored_member(call_target.expression);
	}

	/** Responsibilities: _bind member classification_. **/
	private bind_member(): boolean {
		if (ts.isIdentifier(this._expression)) {
			return this._alias_declarations.member_alias_property(
				this._expression,
				this._node,
				this._bind_name,
				this._member_aliases,
			);
		}
		if (ts.isPropertyAccessExpression(this._expression)) {
			return this._expression.name.text === this._bind_name;
		}
		if (!ts.isElementAccessExpression(this._expression)) {
			return false;
		}
		if (this._expression.argumentExpression === undefined) {
			return false;
		}
		return this._static_value(this._expression.argumentExpression, this._node) === this._bind_name;
	}

	/** Responsibilities: _call context setup_. **/
	public constructor(options: TypeScriptStoredBindCallOptions) {
		this._alias_declarations = options.alias_declarations;
		this._bind_name = "bind";
		this._expression = options.expression;
		this._member_aliases = options.member_aliases;
		this._node = options.node;
		this._static_value = options.static_value;
	}

	/** Responsibilities: _bind member aliases_. **/
	public stored_member(member: ts.Expression): boolean {
		if (ts.isIdentifier(member)) {
			return this._alias_declarations.member_alias_property(member, this._node, this._bind_name, this._member_aliases);
		}
		if (ts.isPropertyAccessExpression(member)) {
			if (member.name.text !== this._bind_name) {
				return this._alias_declarations.member_alias_property(
					member.expression,
					this._node,
					member.name.text,
					this._member_aliases,
				);
			}
			return true;
		}
		return ts.isElementAccessExpression(member);
	}

	/** Responsibilities: _bind call classification_. **/
	public matches(): boolean {
		if (this.bind_member()) {
			return true;
		}
		if (this.function_bind_call()) {
			return true;
		}
		return this.stored_forwarding();
	}
}
