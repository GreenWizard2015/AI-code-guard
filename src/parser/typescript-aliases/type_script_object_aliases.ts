import { TypeScriptExpressionNames } from "src/parser/typescript-aliases/type_script_expression_names";
import { TypeScriptObjectPropertyValueSearch } from "src/parser/typescript-aliases/type_script_object_property_value_search";
import type { ExpressionNamesContract } from "src/runtime_protocols";
import type { TypeScriptObjectAliasDeclarationIndexContract } from "src/typescript_runtime_protocols";
import type { TypeScriptObjectPropertyValueSearchOptions } from "src/typescript_runtime_protocols";
import ts from "typescript";

/** Responsibilities: _object alias tracking_, _property value resolution_. **/
export class TypeScriptObjectAliases {
	private readonly _expression_names: ExpressionNamesContract;
	private readonly _aliases: Map<string, ts.ObjectLiteralExpression>;
	private readonly _declaration_index: TypeScriptObjectAliasDeclarationIndexContract;

	/** Responsibilities: _object alias declaration addition_. **/
	private append_value(name: string, initializer: ts.Expression): boolean {
		const value = this.value(initializer);
		if (!ts.isObjectLiteralExpression(value) || this._aliases.has(name)) {
			return false;
		}
		this._aliases.set(name, value);
		return true;
	}

	/** Responsibilities: _object variable addition_. **/
	private append_variable(node: ts.VariableDeclaration): boolean {
		if (!ts.isIdentifier(node.name)) {
			return false;
		}
		if (node.initializer === undefined) {
			return false;
		}
		return this.append_value(node.name.text, node.initializer);
	}

	/** Responsibilities: _object assignment addition_. **/
	private append_assignment(node: ts.BinaryExpression): boolean {
		if (node.operatorToken.kind !== ts.SyntaxKind.EqualsToken) {
			return false;
		}
		if (!ts.isIdentifier(node.left)) {
			return false;
		}
		return this.append_value(node.left.text, node.right);
	}

	/** Responsibilities: _object alias declaration addition_. **/
	private append(node: ts.Node): boolean {
		if (ts.isVariableDeclaration(node)) {
			return this.append_variable(node);
		}
		if (ts.isBinaryExpression(node)) {
			return this.append_assignment(node);
		}
		return false;
	}

	/** Responsibilities: _object alias declaration eligibility_. **/
	private alias_candidate(node: ts.Node): boolean {
		let expression: ts.Expression | undefined;
		if (ts.isVariableDeclaration(node)) {
			expression = node.initializer;
		} else if (ts.isBinaryExpression(node) && node.operatorToken.kind === ts.SyntaxKind.EqualsToken) {
			expression = node.right;
		}
		while (expression !== undefined && ts.isParenthesizedExpression(expression)) {
			expression = expression.expression;
		}
		return expression !== undefined && (ts.isObjectLiteralExpression(expression) || ts.isIdentifier(expression));
	}

	/** Responsibilities: _object aliases collection_. **/
	/** Responsibilities: _field initialization_. **/
	public constructor(declaration_index: TypeScriptObjectAliasDeclarationIndexContract) {
		this._expression_names = new TypeScriptExpressionNames();
		this._aliases = new Map<string, ts.ObjectLiteralExpression>();
		this._declaration_index = declaration_index;
	}
	/** Responsibilities: _public operation_. **/
	public collect(scope: ts.Node): void {
		const candidates = this._declaration_index
			.declarations(scope)
			.filter((declaration) => this.alias_candidate(declaration));
		let changed = true;
		while (changed) {
			changed = false;
			for (const declaration of candidates) {
				if (this.append(declaration)) {
					changed = true;
				}
			}
		}
	}

	/** Responsibilities: _object alias value resolution_. **/
	public value(expression: ts.Expression): ts.Expression {
		let current = expression;
		const seen = new Set<string>();
		while (ts.isParenthesizedExpression(current)) {
			current = current.expression;
		}
		while (ts.isIdentifier(current) && !seen.has(current.text)) {
			const object_value = this._aliases.get(current.text);
			if (object_value === undefined) {
				break;
			}
			seen.add(current.text);
			current = object_value;
		}
		return current;
	}

	/** Responsibilities: _object property values resolution_. **/
	public property_values(expression: ts.Expression, property_name: string): readonly ts.Expression[] {
		const object = this.value(expression);
		if (!ts.isObjectLiteralExpression(object)) {
			return [];
		}
		const options: TypeScriptObjectPropertyValueSearchOptions = {
			aliases: this,
			expression_names: this._expression_names,
			property_name,
		};
		const search = new TypeScriptObjectPropertyValueSearch(options);
		search.collect(object);
		return search.values();
	}
}
