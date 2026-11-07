import { TypeScriptExpressionAliases } from "src/parser/typescript-aliases/type_script_expression_aliases";
import { TypeScriptObjectAliases } from "src/parser/typescript-aliases/type_script_object_aliases";
import type { StaticExpressionValuesContract } from "src/shared_services_protocols";
import type {
	TypeScriptExpressionAliasesContract,
	TypeScriptObjectAliasDeclarationIndexContract,
	TypeScriptObjectAliasesContract,
} from "src/typescript_runtime_protocols";
import ts from "typescript";

/** Responsibilities: _console alias state_, _scope-specific alias lookup_. **/
export class ConsoleAliasIndex {
	private readonly _expression_aliases: TypeScriptExpressionAliasesContract;
	private readonly _static_expression_values: StaticExpressionValuesContract;
	private readonly _aliases_by_scope: Map<ts.Node, TypeScriptObjectAliasesContract>;
	private readonly _declaration_index: TypeScriptObjectAliasDeclarationIndexContract;

	/** Responsibilities: _alias scope selection_. **/
	private scope_key(scoped_expression: ts.Node): ts.Node {
		let current = scoped_expression;
		while (!ts.isSourceFile(current)) {
			if (ts.isFunctionLike(current)) {
				return current;
			}
			current = current.parent;
		}
		return current;
	}

	/** Responsibilities: _enclosing callable scopes_. **/
	private scope_nodes(descendant: ts.Node): ts.Node[] {
		const scopes: ts.Node[] = [];
		let current = descendant;
		while (!ts.isSourceFile(current)) {
			if (ts.isFunctionLike(current)) {
				scopes.push(current);
			}
			current = current.parent;
		}
		scopes.push(current);
		return scopes.reverse();
	}

	/** Responsibilities: _scope alias index lookup_. **/
	private object_aliases(alias_source: ts.Node): TypeScriptObjectAliasesContract {
		const key = this.scope_key(alias_source);
		const cached = this._aliases_by_scope.get(key);
		if (cached !== undefined) {
			return cached;
		}
		const aliases = new TypeScriptObjectAliases(this._declaration_index);
		for (const scope of this.scope_nodes(alias_source)) {
			aliases.collect(scope);
		}
		this._aliases_by_scope.set(key, aliases);
		return aliases;
	}

	/** Responsibilities: _console computed alias lookup_. **/
	private console_element(expression: ts.ElementAccessExpression, source: ts.Node): boolean {
		const key = expression.argumentExpression;
		if (key === undefined) {
			return false;
		}
		const property_name = this._static_expression_values.value(key, source);
		const aliases = this.object_aliases(source).property_values(expression.expression, property_name);
		return aliases.some((value) => this.console_expression(value, source));
	}

	/** Responsibilities: _console alias index initialization_. **/
	public constructor(
		declaration_index: TypeScriptObjectAliasDeclarationIndexContract,
		static_expression_values: StaticExpressionValuesContract,
	) {
		this._expression_aliases = new TypeScriptExpressionAliases("", declaration_index);
		this._static_expression_values = static_expression_values;
		this._aliases_by_scope = new Map<ts.Node, TypeScriptObjectAliasesContract>();
		this._declaration_index = declaration_index;
	}

	/** Responsibilities: _static mock member resolution_. **/
	public member_name(member_expression: ts.Expression, lookup_site: ts.Node): string {
		if (ts.isPropertyAccessExpression(member_expression)) {
			return member_expression.name.text;
		}
		if (!ts.isElementAccessExpression(member_expression)) {
			return "";
		}
		const key = member_expression.argumentExpression;
		if (key === undefined) {
			return "";
		}
		const unwrapped_key = this._expression_aliases.unwrapped(key);
		if (ts.isStringLiteral(unwrapped_key) || ts.isNoSubstitutionTemplateLiteral(unwrapped_key)) {
			return unwrapped_key.text;
		}
		return this._static_expression_values.value(key, lookup_site);
	}

	/** Responsibilities: _console expression resolution_. **/
	public console_expression(receiver_expression: ts.Expression, lookup_source: ts.Node): boolean {
		if (ts.isIdentifier(receiver_expression)) {
			return receiver_expression.text === "console";
		}
		if (ts.isPropertyAccessExpression(receiver_expression)) {
			const aliases = this.object_aliases(lookup_source).property_values(
				receiver_expression.expression,
				receiver_expression.name.text,
			);
			return aliases.some((value) => this.console_expression(value, lookup_source));
		}
		if (ts.isElementAccessExpression(receiver_expression)) {
			return this.console_element(receiver_expression, lookup_source);
		}
		return false;
	}
}
