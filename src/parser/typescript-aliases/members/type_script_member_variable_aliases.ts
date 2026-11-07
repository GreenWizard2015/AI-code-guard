import type { StringSetMap } from "src/analysis_types";
import type { MemberBindingAliasQuery, VariableAliasContext } from "src/parser/typescript-aliases/protocols";
import { TypeScriptBindingAliases } from "src/parser/typescript-aliases/type_script_binding_aliases";
import { TypeScriptExpressionNames } from "src/parser/typescript-aliases/type_script_expression_names";
import type { ExpressionNamesContract } from "src/runtime_protocols";
import type {
	CallableExpressionUnwrapper,
	CallableMemberAliasAppender,
	CallableMemberValueAppender,
} from "src/runtime_types";
import type { TypeScriptMemberVariableAliasesContract } from "src/typescript_analysis_protocols";
import type { TypeScriptExpressionAliasesContract } from "src/typescript_runtime_protocols";
import ts from "typescript";

/** Responsibilities: _property variable alias collection_, _destructured binding resolution_. **/
export class TypeScriptMemberVariableAliases implements TypeScriptMemberVariableAliasesContract {
	private readonly _expression_names: ExpressionNamesContract;
	private readonly _binding_aliases: TypeScriptBindingAliases;
	private readonly _target_aliases: TypeScriptExpressionAliasesContract;
	private readonly _add_alias: CallableMemberAliasAppender;
	private readonly _append_value: CallableMemberValueAppender;
	private readonly _unwrap_expression: CallableExpressionUnwrapper;

	/** Responsibilities: _property member alias_. **/
	private property(context: VariableAliasContext): boolean {
		const { aliases, node } = context;
		if (!ts.isIdentifier(node.name)) {
			return false;
		}
		if (node.initializer === undefined) {
			return false;
		}
		if (!ts.isPropertyAccessExpression(node.initializer)) {
			return false;
		}
		if (!this._target_aliases.receiver({ expression: node.initializer.expression, node: node })) {
			return false;
		}
		return this._add_alias(aliases, node.name.text, node.initializer.name.text);
	}

	/** Responsibilities: _destructured member alias collection_. **/
	private append_binding_aliases(query: MemberBindingAliasQuery): boolean {
		let changed = false;
		for (const element of query.binding.elements) {
			if (!ts.isBindingElement(element)) {
				continue;
			}
			if (!ts.isIdentifier(element.name)) {
				continue;
			}
			const property_name = this._expression_names.static_binding_name(element);
			if (this._add_alias(query.aliases, element.name.text, property_name)) {
				changed = true;
			}
		}
		return changed;
	}

	/** Responsibilities: _literal binding alias collection_. **/
	private literal(context: VariableAliasContext): boolean {
		const { aliases, node } = context;
		const initializer = node.initializer;
		if (initializer === undefined) {
			return false;
		}
		if (ts.isIdentifier(node.name)) {
			return this._append_value({ aliases, name: node.name.text, initializer, node });
		}
		if (!ts.isObjectBindingPattern(node.name) && !ts.isArrayBindingPattern(node.name)) {
			return false;
		}
		return this._binding_aliases.append_binding_aliases(
			new Set<string>(),
			node.name,
			initializer,
			(expression) => this._unwrap_expression(expression),
			(name, value) => this._append_value({ aliases, name, initializer: value, node }),
		);
	}

	/** Responsibilities: _member alias dependencies_. **/
	public constructor(
		target_aliases: TypeScriptExpressionAliasesContract,
		add_alias: CallableMemberAliasAppender,
		append_value: CallableMemberValueAppender,
		unwrap_expression: CallableExpressionUnwrapper,
	) {
		this._expression_names = new TypeScriptExpressionNames();
		this._binding_aliases = new TypeScriptBindingAliases(this._expression_names);
		this._target_aliases = target_aliases;
		this._add_alias = add_alias;
		this._append_value = append_value;
		this._unwrap_expression = unwrap_expression;
	}

	/** Responsibilities: _member property alias collection_. **/
	public append_member(aliases: StringSetMap, node: ts.VariableDeclaration): boolean {
		const context = { aliases, node };
		let changed = this.property(context);
		if (!ts.isObjectBindingPattern(node.name)) {
			return changed;
		}
		if (node.initializer === undefined) {
			return changed;
		}
		if (!this._target_aliases.receiver({ expression: node.initializer, node: node })) {
			return changed;
		}
		if (this.append_binding_aliases({ aliases, binding: node.name })) {
			changed = true;
		}
		return changed;
	}

	/** Responsibilities: _member variable alias collection_. **/
	public append(aliases: StringSetMap, node: ts.VariableDeclaration): boolean {
		const changed = this.append_member(aliases, node);
		if (this.literal({ aliases, node })) {
			return true;
		}
		return changed;
	}
}
