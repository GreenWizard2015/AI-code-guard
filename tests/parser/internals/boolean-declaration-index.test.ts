import { describe, expect, test } from "@jest/globals";
import { TypeScriptVariableDeclarationIndex } from "src/linting/type_script_variable_declaration_index";
import { TypeScriptBooleanExpression } from "src/parser/internals/type_script_boolean_expression";
import ts from "typescript";

describe("TypeScript boolean declaration index", () => {
	test("resolves repeated accesses to undeclared boolean properties", () => {
		const source = ts.createSourceFile(
			"boolean-property.ts",
			"interface Model { active: boolean; } function check(model: Model) { return model.missing || model.missing; }",
			ts.ScriptTarget.Latest,
			true,
		);
		const resolver = new TypeScriptBooleanExpression(new TypeScriptVariableDeclarationIndex());
		const expressions: ts.PropertyAccessExpression[] = [];
		/** Responsibilities: _boolean property access collection_. **/
		const visit = (node: ts.Node): void => {
			if (ts.isPropertyAccessExpression(node) && node.name.text === "missing") {
				expressions.push(node);
			}
			ts.forEachChild(node, visit);
		};
		visit(source);
		const results = expressions.map((expression) => resolver.boolean_expression(expression, source));

		expect(results).toEqual([false, false]);
	});

	test("resolves repeated calls to a boolean declaration", () => {
		const source = ts.createSourceFile(
			"boolean-callable.ts",
			"function ready(): boolean { return true; } function check() { return ready() || ready(); }",
			ts.ScriptTarget.Latest,
			true,
		);
		const resolver = new TypeScriptBooleanExpression(new TypeScriptVariableDeclarationIndex());
		const calls: ts.CallExpression[] = [];
		/** Responsibilities: _boolean callable collection_. **/
		const visit = (node: ts.Node): void => {
			if (ts.isCallExpression(node) && ts.isIdentifier(node.expression) && node.expression.text === "ready") {
				calls.push(node);
			}
			ts.forEachChild(node, visit);
		};
		visit(source);
		const results = calls.map((call) => resolver.boolean_expression(call, source));

		expect(results).toEqual([true, true]);
	});

	test("resolves a direct boolean literal without project declarations", () => {
		const source = ts.createSourceFile("literal.ts", "true;", ts.ScriptTarget.Latest, true);
		const statement = source.statements.find(ts.isExpressionStatement);
		const resolver = new TypeScriptBooleanExpression(new TypeScriptVariableDeclarationIndex());
		let result = false;
		if (statement !== undefined) {
			result = resolver.boolean_expression(statement.expression, source);
		}

		expect(result).toBe(true);
	});
});
