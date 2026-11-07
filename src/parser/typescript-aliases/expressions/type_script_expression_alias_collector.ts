import type { TypeScriptExpressionAliasCollectorContract } from "src/parser/typescript-aliases/protocols";
import { TypeScriptBindingAliases } from "src/parser/typescript-aliases/type_script_binding_aliases";
import { TypeScriptExpressionNames } from "src/parser/typescript-aliases/type_script_expression_names";
import { TypeScriptObjectAliases } from "src/parser/typescript-aliases/type_script_object_aliases";
import type { ExpressionNamesContract } from "src/runtime_protocols";
import type {
	TypeScriptExpressionAliasesContract,
	TypeScriptObjectAliasDeclarationIndexContract,
	TypeScriptObjectAliasesContract,
} from "src/typescript_runtime_protocols";
import ts from "typescript";

/** Responsibilities: _declaration alias collection_, _assignment alias collection_. **/
export class TypeScriptExpressionAliasCollector implements TypeScriptExpressionAliasCollectorContract {
	private readonly _owner: TypeScriptExpressionAliasesContract;
	private readonly _expression_names: ExpressionNamesContract;
	private readonly _binding_aliases: TypeScriptBindingAliases;
	private readonly _declaration_index: TypeScriptObjectAliasDeclarationIndexContract;

	/** Responsibilities: _variable declaration alias application_. **/
	private append_declaration_alias(
		aliases: Set<string>,
		node: ts.VariableDeclaration,
		object_aliases: TypeScriptObjectAliasesContract,
	): boolean {
		if (node.initializer === undefined) {
			return false;
		}
		if (ts.isIdentifier(node.name)) {
			return this._owner.append_alias(aliases, node.name.text, node.initializer);
		}
		return this._binding_aliases.append_binding_aliases(
			aliases,
			node.name,
			node.initializer,
			(expression) => object_aliases.value(this._owner.unwrapped(expression)),
			(name, initializer) => this._owner.append_alias(aliases, name, initializer),
		);
	}

	/** Responsibilities: _collector initialization_. **/
	public constructor(
		owner: TypeScriptExpressionAliasesContract,
		declaration_index: TypeScriptObjectAliasDeclarationIndexContract,
	) {
		this._expression_names = new TypeScriptExpressionNames();
		this._binding_aliases = new TypeScriptBindingAliases(this._expression_names);
		this._declaration_index = declaration_index;
		this._owner = owner;
	}

	/** Responsibilities: _scope alias names_. **/
	public collect(scope: ts.Node): ReadonlySet<string> {
		const aliases = new Set<string>();
		const object_aliases = new TypeScriptObjectAliases(this._declaration_index);
		object_aliases.collect(scope);
		const declarations = this._declaration_index.declarations(scope);
		let changed = true;
		while (changed) {
			changed = false;
			for (const declaration of declarations) {
				if (this.append_scope_aliases(aliases, declaration, scope, object_aliases)) {
					changed = true;
				}
			}
		}
		return aliases;
	}

	/** Responsibilities: _scope alias declaration application_. **/
	public append_scope_aliases(
		aliases: Set<string>,
		node: ts.Node,
		root: ts.Node,
		object_aliases: TypeScriptObjectAliasesContract,
	): boolean {
		if (node !== root && ts.isFunctionLike(node)) {
			return false;
		}
		let changed = false;
		if (ts.isVariableDeclaration(node)) {
			changed = this.append_declaration_alias(aliases, node, object_aliases);
		}
		if (ts.isBinaryExpression(node)) {
			if (node.operatorToken.kind === ts.SyntaxKind.EqualsToken && ts.isIdentifier(node.left)) {
				if (this._owner.append_alias(aliases, node.left.text, node.right)) {
					changed = true;
				}
			}
		}
		return changed;
	}
}
