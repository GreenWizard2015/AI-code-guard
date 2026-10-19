import { describe, expect, test } from "@jest/globals";
import ts from "typescript";
import { TypeScriptBooleanExpression } from "src/parser/internals/type_script_boolean_expression";
import { TypeScriptVariableDeclarationIndex } from "src/linting/type_script_variable_declaration_index";

describe("TypeScript boolean declaration index", () => {
	test("reuses boolean property declarations for repeated expressions", () => {
		const source = ts.createSourceFile(
			"boolean-property.ts",
			"interface Model { active: boolean; } function check(model: Model) { return model.missing || model.missing; }",
			ts.ScriptTarget.Latest,
			true,
		);
		const declarations = source.statements.find(ts.isInterfaceDeclaration);
		const property = declarations?.members.find(ts.isPropertySignature);
		let declaration_name_reads = 0;
		if (property !== undefined) {
			const declaration_name = property.name;
			const original_get_text = declaration_name.getText;
			Object.defineProperty(declaration_name, "getText", {
				value: () => {
					declaration_name_reads += 1;
					return original_get_text.call(declaration_name, source);
				},
			});
		}
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

		expect({ results, declaration_name_reads }).toEqual({ results: [false, false], declaration_name_reads: 1 });
	});

	test("reuses boolean callable declarations for repeated expressions", () => {
		const source = ts.createSourceFile(
			"boolean-callable.ts",
			"function ready(): boolean { return true; } function check() { return ready() || ready(); }",
			ts.ScriptTarget.Latest,
			true,
		);
		const declaration = source.statements.find(ts.isFunctionDeclaration);
		let declaration_name_reads = 0;
		const declaration_name = declaration?.name;
		if (declaration_name !== undefined) {
			const original_get_text = declaration_name.getText;
			Object.defineProperty(declaration_name, "getText", {
				value: () => {
					declaration_name_reads += 1;
					return original_get_text.call(declaration_name, source);
				},
			});
		}
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

		expect({ results, declaration_name_reads }).toEqual({ results: [true, true], declaration_name_reads: 1 });
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
