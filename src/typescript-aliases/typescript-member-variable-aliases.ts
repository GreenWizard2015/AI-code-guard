import ts from "typescript";
import { TypeScriptBindingAliases } from "src/typescript-aliases/typescript-binding-aliases";
import type {
	ExpressionUnwrapper,
	MemberAliasAppender,
	MemberValueAppender,
	TypeScriptExpressionAliasesProtocol,
} from "src/protocols";
import { TypeScriptExpressionNames } from "src/typescript-aliases/typescript-expression-names";

/** Responsibilities: _member variable alias resolution_. **/
export class TypeScriptMemberVariableAliases {
	private readonly expression_names = new TypeScriptExpressionNames();
	private readonly binding_aliases = new TypeScriptBindingAliases();
	private readonly target_aliases: TypeScriptExpressionAliasesProtocol;
	private readonly add_alias: MemberAliasAppender;
	private readonly append_value: MemberValueAppender;
	private readonly unwrap_expression: ExpressionUnwrapper;

	/** Responsibilities: _property member alias_. **/
	private property(aliases: Map<string, Set<string>>, node: ts.VariableDeclaration): boolean {
		if (!ts.isIdentifier(node.name) || node.initializer === undefined) {
			return false;
		}
		if (!ts.isPropertyAccessExpression(node.initializer)) {
			return false;
		}
		if (!this.target_aliases.receiver(node.initializer.expression, node)) {
			return false;
		}
		return this.add_alias(aliases, node.name.text, node.initializer.name.text);
	}

	/** Responsibilities: _binding member aliases_. **/
	private binding(aliases: Map<string, Set<string>>, node: ts.VariableDeclaration): boolean {
		if (!ts.isObjectBindingPattern(node.name) || node.initializer === undefined) {
			return false;
		}
		if (!this.target_aliases.receiver(node.initializer, node)) {
			return false;
		}
		let changed = false;
		for (const element of node.name.elements) {
			if (!ts.isBindingElement(element) || !ts.isIdentifier(element.name)) {
				continue;
			}
			const property_name = this.expression_names.static_binding_name(element);
			if (this.add_alias(aliases, element.name.text, property_name)) {
				changed = true;
			}
		}
		return changed;
	}

	/** Responsibilities: _literal member aliases_. **/
	private literal(aliases: Map<string, Set<string>>, node: ts.VariableDeclaration): boolean {
		if (node.initializer === undefined) {
			return false;
		}
		if (ts.isIdentifier(node.name)) {
			return this.append_value(aliases, node.name.text, node.initializer, node);
		}
		if (!ts.isObjectBindingPattern(node.name) && !ts.isArrayBindingPattern(node.name)) {
			return false;
		}
		return this.binding_aliases.append_binding_aliases(
			new Set<string>(),
			node.name,
			node.initializer,
			(expression) => this.unwrap_expression(expression),
			(name, initializer) => this.append_value(aliases, name, initializer, node),
		);
	}

	/** Responsibilities: _member alias dependencies_. **/
	public constructor(
		target_aliases: TypeScriptExpressionAliasesProtocol,
		add_alias: MemberAliasAppender,
		append_value: MemberValueAppender,
		unwrap_expression: ExpressionUnwrapper,
	) {
		this.target_aliases = target_aliases;
		this.add_alias = add_alias;
		this.append_value = append_value;
		this.unwrap_expression = unwrap_expression;
	}

	/** Responsibilities: _member property alias collection_. **/
	public append_member(aliases: Map<string, Set<string>>, node: ts.VariableDeclaration): boolean {
		let changed = false;
		if (this.property(aliases, node)) {
			changed = true;
		}
		if (this.binding(aliases, node)) {
			changed = true;
		}
		return changed;
	}

	/** Responsibilities: _member variable alias collection_. **/
	public append(aliases: Map<string, Set<string>>, node: ts.VariableDeclaration): boolean {
		let changed = this.append_member(aliases, node);
		if (this.literal(aliases, node)) {
			changed = true;
		}
		return changed;
	}
}
