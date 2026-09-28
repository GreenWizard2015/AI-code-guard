import ts from 'typescript';
import { TypeScriptExpressionAliases } from 'src/typescript-aliases/typescript-expression-aliases';
import { TypeScriptObjectAliases } from 'src/typescript-aliases/typescript-object-aliases';
import { TypeScriptStaticArrayKeys } from 'src/typescript-callable-aliases/static-array/typescript-static-array-keys';

/** Responsibilities: _dynamic object member ownership_. **/
export class DynamicObjectMemberAliases {
	private readonly target_aliases: TypeScriptExpressionAliases;
	private readonly array_aliases = new TypeScriptStaticArrayKeys();

	/** Responsibilities: _object alias source resolution_. **/
	private source_objects(node: ts.Node): TypeScriptObjectAliases {
		const aliases = new TypeScriptObjectAliases();
		const scopes: ts.Node[] = [];
		let current = node;
		while (!ts.isSourceFile(current)) {
			if (ts.isFunctionLike(current)) {
				scopes.push(current);
			}
			current = current.parent;
		}
		scopes.push(current);
		for (const scope of scopes.reverse()) {
			aliases.collect(scope);
		}
		return aliases;
	}

	/** Responsibilities: _object member source collection_. **/
	private source_values(
		expression: ts.Expression,
		source: ts.Node,
		property_name: string
	): readonly ts.Expression[] {
		const objects = this.source_objects(source);
		const values = objects.property_values(expression, property_name);
		const array_values = this.array_aliases.expressions(expression, source.getSourceFile());
		const array_property_values = array_values.flatMap(value =>
			objects.property_values(value, property_name)
		);
		return [...values, ...array_property_values];
	}

	/** Responsibilities: _dynamic member expression classification_. **/
	private member_expression(expression: ts.Expression): boolean {
		if (ts.isPropertyAccessExpression(expression)) {
			return true;
		}
		return ts.isElementAccessExpression(expression);
	}

	/** Responsibilities: _dynamic array receiver resolution_. **/
	private array_receiver(expression: ts.Expression, source: ts.Node): boolean {
		const array_values = this.array_aliases.expressions(
			expression,
			source.getSourceFile()
		);
		return array_values.some(value => this.target_aliases.receiver(value, source));
	}

	/** Responsibilities: _dynamic source receiver resolution_. **/
	private source_receiver(expression: ts.Expression, source: ts.Node): boolean {
		const property_name = this.member_name(expression);
		if (property_name === '') {
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
	public constructor(target_name: string = 'Reflect') {
		this.target_aliases = new TypeScriptExpressionAliases(target_name);
	}

	/** Responsibilities: _object member name resolution_. **/
	public member_name(expression: ts.Expression): string {
		if (ts.isPropertyAccessExpression(expression)) {
			return expression.name.text;
		}
		if (!ts.isElementAccessExpression(expression) || expression.argumentExpression === undefined) {
			return '';
		}
		return this.target_aliases.member_name(expression);
	}

	/** Responsibilities: _object member target resolution_. **/
	public receiver(expression: ts.Expression, source: ts.Node): boolean {
		if (!this.member_expression(expression)) {
			return false;
		}
		if (this.array_receiver(expression, source)) {
			return true;
		}
		return this.source_receiver(expression, source);
	}

	/** Responsibilities: _object member alias resolution_. **/
	public member(expression: ts.Expression, source: ts.Node, member_name: string): boolean {
		if (!ts.isPropertyAccessExpression(expression) && !ts.isElementAccessExpression(expression)) {
			return false;
		}
		const property_name = this.member_name(expression);
		if (property_name === '') {
			return false;
		}
		const values = this.source_objects(source).property_values(expression.expression, property_name);
		return values.some(value => {
			if (!ts.isPropertyAccessExpression(value) && !ts.isElementAccessExpression(value)) {
				return false;
			}
			return this.target_aliases.receiver(value.expression, source) && this.member_name(value) === member_name;
		});
	}
}
