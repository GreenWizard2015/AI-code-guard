import ts from "typescript";
import { TypeScriptBindingAliases } from "src/typescript-aliases/type_script_binding_aliases";
import { TypeScriptObjectAliases } from "src/typescript-aliases/type_script_object_aliases";
import { TypeScriptObjectAliasDeclarationIndex } from "src/typescript-aliases/type_script_object_alias_declaration_index";
import { TypeScriptExpressionNames } from "src/typescript-aliases/type_script_expression_names";
import type { TypeScriptExpressionAliasesContract, TypeScriptObjectAliasesContract } from "src/typescript_runtime_protocols";
import type { TypeScriptExpressionAliasCollectorContract } from "src/typescript_analysis_protocols";

/** Responsibilities: _declaration alias collection_, _assignment alias collection_. **/
export class TypeScriptExpressionAliasCollector implements TypeScriptExpressionAliasCollectorContract {
	private readonly owner: TypeScriptExpressionAliasesContract;
	private readonly expression_names: TypeScriptExpressionNames;
	private readonly binding_aliases: TypeScriptBindingAliases;
	private readonly declaration_index: TypeScriptObjectAliasDeclarationIndex;

	/** Responsibilities: _pattern alias collection_. **/
	private append_pattern_alias(
		aliases: Set<string>,
		node: ts.VariableDeclaration,
		object_aliases: TypeScriptObjectAliasesContract,
	): boolean {
		if (node.initializer === undefined) {
			return false;
		}
		return this.binding_aliases.append_binding_aliases(
			aliases,
			node.name,
			node.initializer,
			(expression) => object_aliases.value(this.owner.unwrapped(expression)),
			(name, initializer) => this.owner.append_alias(aliases, name, initializer),
		);
	}

	/** Responsibilities: _variable alias collection_. **/
	private append_variable_alias(
		aliases: Set<string>,
		node: ts.VariableDeclaration,
		object_aliases: TypeScriptObjectAliasesContract,
	): boolean {
		if (node.initializer === undefined) {
			return false;
		}
		if (ts.isIdentifier(node.name)) {
			return this.owner.append_alias(aliases, node.name.text, node.initializer);
		}
		return this.append_pattern_alias(aliases, node, object_aliases);
	}

	/** Responsibilities: _assignment alias collection_. **/
	private append_assignment_alias(aliases: Set<string>, node: ts.BinaryExpression): boolean {
		if (node.operatorToken.kind !== ts.SyntaxKind.EqualsToken) {
			return false;
		}
		if (!ts.isIdentifier(node.left)) {
			return false;
		}
		return this.owner.append_alias(aliases, node.left.text, node.right);
	}

	/** Responsibilities: _collector initialization_. **/
	public constructor(owner: TypeScriptExpressionAliasesContract) {
		this.expression_names = new TypeScriptExpressionNames();
		this.binding_aliases = new TypeScriptBindingAliases(this.expression_names);
		this.declaration_index = new TypeScriptObjectAliasDeclarationIndex();
		this.owner = owner;
	}

	/** Responsibilities: _scope alias declaration application_. **/
	public append_scope_aliases(
		aliases: Set<string>,
		node: ts.Node,
		root: ts.Node,
		object_aliases: TypeScriptObjectAliasesContract,
	): boolean {
		if (node !== root) {
			if (ts.isFunctionLike(node)) {
				return false;
			}
		}
		let changed = false;
		if (ts.isVariableDeclaration(node)) {
			if (this.append_variable_alias(aliases, node, object_aliases)) {
				changed = true;
			}
		}
		if (ts.isBinaryExpression(node) && this.append_assignment_alias(aliases, node)) {
			changed = true;
		}
		return changed;
	}

	/** Responsibilities: _scope alias names_. **/
	public collect(scope: ts.Node): ReadonlySet<string> {
		const aliases = new Set<string>();
		const object_aliases = new TypeScriptObjectAliases(this.declaration_index);
		object_aliases.collect(scope);
		const declarations = this.declaration_index.declarations(scope);
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
}
