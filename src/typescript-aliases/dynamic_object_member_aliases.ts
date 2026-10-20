import ts from "typescript";
import { TypeScriptExpressionAliases } from "src/typescript-aliases/type_script_expression_aliases";
import { TypeScriptObjectAliases } from "src/typescript-aliases/type_script_object_aliases";
import { TypeScriptObjectAliasDeclarationIndex } from "src/typescript-aliases/type_script_object_alias_declaration_index";
import { TypeScriptStaticArrayKeys } from "src/type_script_static_array_keys";
import type { DynamicObjectMemberAliasesContract } from "src/runtime_protocols";
import type { TypeScriptExpressionAliasesContract, TypeScriptObjectAliasesContract, TypeScriptStaticArrayKeysContract } from "src/typescript_runtime_protocols";

/** Responsibilities: _object member value ownership_, _dynamic member alias resolution_. **/
export class DynamicObjectMemberAliases implements DynamicObjectMemberAliasesContract {
	private readonly target_aliases: TypeScriptExpressionAliasesContract;
	private readonly array_aliases: TypeScriptStaticArrayKeysContract;
	private readonly aliases_by_scope: Map<ts.Node, TypeScriptObjectAliasesContract>;
	private readonly declaration_index: TypeScriptObjectAliasDeclarationIndex;

	/** Responsibilities: _object member value classification_. **/
	private member_value(value: ts.Expression, source: ts.Node, member_name: string): boolean {
		if (!ts.isPropertyAccessExpression(value) && !ts.isElementAccessExpression(value)) {
			return false;
		}
		if (!this.target_aliases.receiver(value.expression, source)) {
			return false;
		}
		return this.member_name(value) === member_name;
	}

	/** Responsibilities: _object member alias classification_. **/
	private object_member(expression: ts.Expression, source: ts.Node, member_name: string): boolean {
		if (!ts.isPropertyAccessExpression(expression) && !ts.isElementAccessExpression(expression)) {
			return false;
		}
		const property_name = this.member_name(expression);
		if (property_name === "") {
			return false;
		}
		const objects = this.source_objects(source);
		const values = objects.property_values(expression.expression, property_name);
		const array_values = this.array_aliases.expressions(expression.expression, source.getSourceFile());
		const nested_values = array_values.flatMap((value) => objects.property_values(value, property_name));
		const all_values = [...values, ...nested_values];
		return all_values.some((value) => this.member_value(value, source, member_name));
	}

	/** Responsibilities: _object alias source resolution_. **/
	private scope_key(node: ts.Node): ts.Node {
		let current = node;
		while (!ts.isSourceFile(current)) {
			if (ts.isFunctionLike(current)) {
				return current;
			}
			current = current.parent;
		}
		return current;
	}

	/** Responsibilities: _enclosing scope collection_. **/
	private scope_nodes(node: ts.Node): ts.Node[] {
		const scopes: ts.Node[] = [];
		let current = node;
		while (!ts.isSourceFile(current)) {
			if (ts.isFunctionLike(current)) {
				scopes.push(current);
			}
			current = current.parent;
		}
		scopes.push(current);
		return scopes.reverse();
	}

	/** Responsibilities: _object alias source resolution_. **/
	private source_objects(node: ts.Node): TypeScriptObjectAliasesContract {
		const key = this.scope_key(node);
		const cached = this.aliases_by_scope.get(key);
		if (cached !== undefined) {
			return cached;
		}
		const aliases = new TypeScriptObjectAliases(this.declaration_index);
		for (const scope of this.scope_nodes(node)) {
			aliases.collect(scope);
		}
		this.aliases_by_scope.set(key, aliases);
		return aliases;
	}

	/** Responsibilities: _object member source collection_. **/
	private source_values(expression: ts.Expression, source: ts.Node, property_name: string): readonly ts.Expression[] {
		const objects = this.source_objects(source);
		const values = objects.property_values(expression, property_name);
		const array_values = this.array_aliases.expressions(expression, source.getSourceFile());
		const array_property_values = array_values.flatMap((value) => objects.property_values(value, property_name));
		return [...values, ...array_property_values];
	}

	/** Responsibilities: _dynamic member expression classification_. **/
	private member_expression(expression: ts.Expression): boolean {
		if (ts.isPropertyAccessExpression(expression)) {
			return true;
		}
		return ts.isElementAccessExpression(expression);
	}

	/** Responsibilities: _dynamic source receiver resolution_. **/
	private source_receiver(expression: ts.Expression, source: ts.Node): boolean {
		const property_name = this.member_name(expression);
		if (property_name === "") {
			return false;
		}
		if (!ts.isPropertyAccessExpression(expression) && !ts.isElementAccessExpression(expression)) {
			return false;
		}
		for (const value of this.source_values(expression.expression, source, property_name)) {
			if (this.target_aliases.receiver(value, source)) {
				return true;
			}
		}
		return false;
	}

	/** Responsibilities: _dynamic object alias initialization_. **/
	public constructor(target_name: string = "Reflect") {
		this.aliases_by_scope = new Map<ts.Node, TypeScriptObjectAliasesContract>();
		this.declaration_index = new TypeScriptObjectAliasDeclarationIndex();
		this.target_aliases = new TypeScriptExpressionAliases(target_name);
		this.array_aliases = new TypeScriptStaticArrayKeys();
	}

	/** Responsibilities: _object member name resolution_. **/
	public member_name(expression: ts.Expression): string {
		if (ts.isPropertyAccessExpression(expression)) {
			return expression.name.text;
		}
		if (!ts.isElementAccessExpression(expression)) {
			return "";
		}
		if (expression.argumentExpression === undefined) {
			return "";
		}
		return this.target_aliases.member_name(expression);
	}

	/** Responsibilities: _object member target resolution_. **/
	public receiver(expression: ts.Expression, source: ts.Node): boolean {
		if (!this.member_expression(expression)) {
			return false;
		}
		const array_values = this.array_aliases.expressions(expression, source.getSourceFile());
		if (array_values.some((value) => this.target_aliases.receiver(value, source))) {
			return true;
		}
		return this.source_receiver(expression, source);
	}

	/** Responsibilities: _object member alias resolution_. **/
	public member(expression: ts.Expression, source: ts.Node, member_name: string): boolean {
		if (!ts.isPropertyAccessExpression(expression) && !ts.isElementAccessExpression(expression)) {
			return false;
		}
		const array_values = this.array_aliases.expressions(expression, source.getSourceFile());
		if (array_values.some((value) => this.member_value(value, source, member_name))) {
			return true;
		}
		return this.object_member(expression, source, member_name);
	}
}
