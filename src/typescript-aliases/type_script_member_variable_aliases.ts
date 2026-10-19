import ts from "typescript";
import { TypeScriptBindingAliases } from "src/typescript-aliases/type_script_binding_aliases";
import type {
	ExpressionUnwrapper,
	MemberAliasAppender,
	MemberValueAppender,
	StringSetMap,
	TypeScriptMemberVariableAliasesContract,
	TypeScriptExpressionAliasesContract,
} from "src/protocols";
import { TypeScriptExpressionNames } from "src/typescript-aliases/type_script_expression_names";

/** Responsibilities: _property variable alias collection_, _destructured binding resolution_. **/
export class TypeScriptMemberVariableAliases implements TypeScriptMemberVariableAliasesContract {
	private readonly expression_names: TypeScriptExpressionNames;
	private readonly binding_aliases: TypeScriptBindingAliases;
	private readonly target_aliases: TypeScriptExpressionAliasesContract;
	private readonly add_alias: MemberAliasAppender;
	private readonly append_value: MemberValueAppender;
	private readonly unwrap_expression: ExpressionUnwrapper;

	/** Responsibilities: _property member alias_. **/
	private property(aliases: StringSetMap, node: ts.VariableDeclaration): boolean {
		if (!ts.isIdentifier(node.name)) {
			return false;
		}
		if (node.initializer === undefined) {
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

	/** Responsibilities: _binding member alias element_. **/
	private append_binding_element(aliases: StringSetMap, element: ts.BindingElement): boolean {
		if (!ts.isIdentifier(element.name)) {
			return false;
		}
		const property_name = this.expression_names.static_binding_name(element);
		return this.add_alias(aliases, element.name.text, property_name);
	}

	/** Responsibilities: _binding member alias elements_. **/
	private append_binding_elements(aliases: StringSetMap, binding: ts.ObjectBindingPattern): boolean {
		let changed = false;
		for (const element of binding.elements) {
			if (!ts.isBindingElement(element)) {
				continue;
			}
			if (this.append_binding_element(aliases, element)) {
				changed = true;
			}
		}
		return changed;
	}

	/** Responsibilities: _binding member aliases_. **/
	private binding(aliases: StringSetMap, node: ts.VariableDeclaration): boolean {
		if (!ts.isObjectBindingPattern(node.name)) {
			return false;
		}
		if (node.initializer === undefined) {
			return false;
		}
		if (!this.target_aliases.receiver(node.initializer, node)) {
			return false;
		}
		return this.append_binding_elements(aliases, node.name);
	}

	/** Responsibilities: _literal member aliases_. **/
	private literal(aliases: StringSetMap, node: ts.VariableDeclaration): boolean {
		if (node.initializer === undefined) {
			return false;
		}
		if (ts.isIdentifier(node.name)) {
			return this.append_value({ aliases, name: node.name.text, initializer: node.initializer, node });
		}
		if (!ts.isObjectBindingPattern(node.name) && !ts.isArrayBindingPattern(node.name)) {
			return false;
		}
		return this.binding_aliases.append_binding_aliases(
			new Set<string>(),
			node.name,
			node.initializer,
			(expression) => this.unwrap_expression(expression),
			(name, initializer) => this.append_value({ aliases, name, initializer, node }),
		);
	}

	/** Responsibilities: _member alias dependencies_. **/
	public constructor(
		target_aliases: TypeScriptExpressionAliasesContract,
		add_alias: MemberAliasAppender,
		append_value: MemberValueAppender,
		unwrap_expression: ExpressionUnwrapper,
	) {
		this.expression_names = new TypeScriptExpressionNames();
		this.binding_aliases = new TypeScriptBindingAliases(this.expression_names);
		this.target_aliases = target_aliases;
		this.add_alias = add_alias;
		this.append_value = append_value;
		this.unwrap_expression = unwrap_expression;
	}

	/** Responsibilities: _member property alias collection_. **/
	public append_member(aliases: StringSetMap, node: ts.VariableDeclaration): boolean {
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
	public append(aliases: StringSetMap, node: ts.VariableDeclaration): boolean {
		let changed = this.append_member(aliases, node);
		if (this.literal(aliases, node)) {
			changed = true;
		}
		return changed;
	}
}
