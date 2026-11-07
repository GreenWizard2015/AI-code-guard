import { TypeScriptExpressionAliases } from "src/parser/typescript-aliases/type_script_expression_aliases";
import { TypeScriptObjectAliases } from "src/parser/typescript-aliases/type_script_object_aliases";
import type {
	DynamicObjectMemberAliasesContract,
	DynamicObjectMemberNameQuery,
	DynamicObjectMemberQuery,
	DynamicObjectMemberValueQuery,
	DynamicObjectPropertyValuesQuery,
	DynamicObjectReceiverQuery,
} from "src/runtime_protocols";
import type {
	TypeScriptExpressionAliasesContract,
	TypeScriptObjectAliasDeclarationIndexContract,
	TypeScriptObjectAliasesContract,
	TypeScriptStaticArrayKeysContract,
} from "src/typescript_runtime_protocols";
import ts from "typescript";

/** Responsibilities: _object member value ownership_, _dynamic member alias resolution_. **/
export class DynamicObjectMemberAliases implements DynamicObjectMemberAliasesContract {
	private readonly _target_aliases: TypeScriptExpressionAliasesContract;
	private readonly _array_aliases: TypeScriptStaticArrayKeysContract;
	private readonly _aliases_by_scope: Map<ts.Node, TypeScriptObjectAliasesContract>;
	private readonly _declaration_index: TypeScriptObjectAliasDeclarationIndexContract;

	/** Responsibilities: _object member value classification_. **/
	private member_value(query: DynamicObjectMemberValueQuery): boolean {
		const { value, source, member_name } = query;
		if (!ts.isPropertyAccessExpression(value) && !ts.isElementAccessExpression(value)) {
			return false;
		}
		if (!this._target_aliases.receiver({ expression: value.expression, node: source })) {
			return false;
		}
		return this.member_name({ expression: value }) === member_name;
	}

	/** Responsibilities: _object member alias classification_. **/
	private object_member(query: DynamicObjectMemberQuery): boolean {
		const { expression, source, member_name } = query;
		if (!ts.isPropertyAccessExpression(expression) && !ts.isElementAccessExpression(expression)) {
			return false;
		}
		const property_name = this.member_name({ expression });
		if (property_name === "") {
			return false;
		}
		const values = this.source_values({ expression: expression.expression, source, property_name });
		return values.some((value) => this.member_value({ value, source, member_name }));
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
		const source_file = node.getSourceFile();
		const cached = this._aliases_by_scope.get(source_file);
		if (cached !== undefined) {
			return cached;
		}
		const aliases = new TypeScriptObjectAliases(this._declaration_index);
		for (const scope of this.scope_nodes(node)) {
			aliases.collect(scope);
		}
		this._aliases_by_scope.set(source_file, aliases);
		return aliases;
	}

	/** Responsibilities: _object member source collection_. **/
	private source_values(query: DynamicObjectPropertyValuesQuery): readonly ts.Expression[] {
		const { expression, source, property_name } = query;
		const objects = this.source_objects(source);
		const values = objects.property_values(expression, property_name);
		const array_values = this._array_aliases.expressions(expression, source.getSourceFile());
		if (array_values.length === 0) {
			return values;
		}
		const combined_values = [...values];
		for (const array_value of array_values) {
			for (const property_value of objects.property_values(array_value, property_name)) {
				combined_values.push(property_value);
			}
		}
		return combined_values;
	}

	/** Responsibilities: _dynamic source receiver resolution_. **/
	private source_receiver(query: DynamicObjectReceiverQuery): boolean {
		const { expression, source } = query;
		const property_name = this.member_name({ expression });
		if (property_name === "") {
			return false;
		}
		if (!ts.isPropertyAccessExpression(expression) && !ts.isElementAccessExpression(expression)) {
			return false;
		}
		for (const value of this.source_values({ expression: expression.expression, source, property_name })) {
			if (this._target_aliases.receiver({ expression: value, node: source })) {
				return true;
			}
		}
		return false;
	}

	/** Responsibilities: _dynamic object alias initialization_. **/
	public constructor(
		target_name: string,
		array_aliases: TypeScriptStaticArrayKeysContract,
		declaration_index: TypeScriptObjectAliasDeclarationIndexContract,
	) {
		this._aliases_by_scope = new Map<ts.Node, TypeScriptObjectAliasesContract>();
		this._declaration_index = declaration_index;
		this._target_aliases = new TypeScriptExpressionAliases(target_name, declaration_index);
		this._array_aliases = array_aliases;
	}

	/** Responsibilities: _object member name resolution_. **/
	public member_name(query: DynamicObjectMemberNameQuery): string {
		return this._target_aliases.member_name({ expression: query.expression });
	}

	/** Responsibilities: _object member target resolution_. **/
	public receiver(query: DynamicObjectReceiverQuery): boolean {
		const { expression, source } = query;
		if (!ts.isPropertyAccessExpression(expression) && !ts.isElementAccessExpression(expression)) {
			return false;
		}
		const array_values = this._array_aliases.expressions(expression, source.getSourceFile());
		if (array_values.some((value) => this._target_aliases.receiver({ expression: value, node: source }))) {
			return true;
		}
		return this.source_receiver(query);
	}

	/** Responsibilities: _object member alias resolution_. **/
	public member(query: DynamicObjectMemberQuery): boolean {
		const { expression, source, member_name } = query;
		if (!ts.isPropertyAccessExpression(expression) && !ts.isElementAccessExpression(expression)) {
			return false;
		}
		const array_values = this._array_aliases.expressions(expression, source.getSourceFile());
		if (array_values.some((value) => this.member_value({ value, source, member_name }))) {
			return true;
		}
		return this.object_member(query);
	}
}
