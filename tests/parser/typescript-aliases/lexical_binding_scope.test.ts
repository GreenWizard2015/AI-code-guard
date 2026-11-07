import { describe, expect, test } from "@jest/globals";
import { LexicalBindingScope } from "src/parser/typescript-aliases/lexical_binding_scope";
import ts from "typescript";

describe("lexical binding scope", () => {
	test("recognizes imported bindings in the source scope", () => {
		const source = ts.createSourceFile(
			"imports.ts",
			'import DefaultValue, { value as imported_value } from "module"; imported_value;',
			ts.ScriptTarget.Latest,
			true,
		);
		const reference_statement = source.statements.find(ts.isExpressionStatement);
		const scope = new LexicalBindingScope(source);
		let shadowed = false;
		if (reference_statement !== undefined) {
			shadowed = scope.value_name_shadowed(reference_statement.expression, "imported_value");
		}

		expect(shadowed).toBe(true);
	});

	test("resolves declarations inside their containing block", () => {
		const source = ts.createSourceFile(
			"scopes.ts",
			"function run() { { const local_value = 1; local_value; } local_value; }",
			ts.ScriptTarget.Latest,
			true,
		);
		const function_statement = source.statements.find(ts.isFunctionDeclaration);
		const scope = new LexicalBindingScope(source);
		let inner_shadowed = false;
		if (function_statement !== undefined && function_statement.body !== undefined) {
			const first_statement = function_statement.body.statements.find(ts.isBlock);
			if (first_statement !== undefined) {
				const inner_use = first_statement.statements.find(ts.isExpressionStatement);
				if (inner_use !== undefined) {
					inner_shadowed = scope.value_name_shadowed(inner_use.expression, "local_value");
				}
			}
		}

		expect(inner_shadowed).toBe(true);
	});

	test("does not expose block declarations to the outer scope", () => {
		const source = ts.createSourceFile(
			"scopes.ts",
			"function run() { { const local_value = 1; local_value; } local_value; }",
			ts.ScriptTarget.Latest,
			true,
		);
		const function_statement = source.statements.find(ts.isFunctionDeclaration);
		const scope = new LexicalBindingScope(source);
		let outer_shadowed = true;
		if (function_statement !== undefined && function_statement.body !== undefined) {
			const outer_use = function_statement.body.statements.find(ts.isExpressionStatement);
			if (outer_use !== undefined) {
				outer_shadowed = scope.value_name_shadowed(outer_use.expression, "local_value");
			}
		}

		expect(outer_shadowed).toBe(false);
	});

	test("resolves type aliases separately from value declarations", () => {
		const source = ts.createSourceFile(
			"types.ts",
			"type Shape = string; function run() { type Shape = number; const value: Shape = 1; return value; }",
			ts.ScriptTarget.Latest,
			true,
		);
		const scope = new LexicalBindingScope(source);
		const function_statement = source.statements.find(ts.isFunctionDeclaration);
		const variable_statement = function_statement?.body?.statements.find(ts.isVariableStatement);
		const declaration = variable_statement?.declarationList.declarations.find(ts.isVariableDeclaration);
		const value_type = declaration?.type;
		let shadowed = false;
		if (value_type !== undefined && ts.isTypeReferenceNode(value_type)) {
			shadowed = scope.type_name_shadowed(value_type.typeName, "Shape");
		}

		expect(shadowed).toBe(true);
	});
});
