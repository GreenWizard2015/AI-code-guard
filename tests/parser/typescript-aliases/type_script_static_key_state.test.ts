import { describe, expect, test } from "@jest/globals";
import { TypeScriptStaticKeyAliases } from "src/parser/typescript-aliases/type_script_static_key_aliases";
import ts from "typescript";

describe("TypeScript static key scope state", () => {
	test("resolves object properties declared in the current scope", () => {
		const source_file = ts.createSourceFile(
			"scope.ts",
			"function run() { const source = [{ token: 'current' }]; const result = Object.assign({}, ...source); return result.token; }",
			ts.ScriptTarget.Latest,
			true,
		);
		const accesses: ts.PropertyAccessExpression[] = [];
		/** Responsibilities: _property access collection_. **/
		const visit = (node: ts.Node): void => {
			if (ts.isPropertyAccessExpression(node) && node.name.text === "token") {
				accesses.push(node);
			}
			node.forEachChild(visit);
		};
		source_file.forEachChild(visit);
		const aliases = new TypeScriptStaticKeyAliases();

		expect(accesses.map((expression) => aliases.object_property(expression, expression))).toEqual(["current"]);
	});

	test("does not reuse array sources between function scopes", () => {
		const source_file = ts.createSourceFile(
			"scopes.ts",
			"function first() { const source = [{ token: 'first' }]; const result = Object.assign({}, ...source); return result.token; } function second() { const result = Object.assign({}, ...source); return result.token; }",
			ts.ScriptTarget.Latest,
			true,
		);
		const accesses: ts.PropertyAccessExpression[] = [];
		/** Responsibilities: _property access collection_. **/
		const visit = (node: ts.Node): void => {
			if (ts.isPropertyAccessExpression(node) && node.name.text === "token") {
				accesses.push(node);
			}
			node.forEachChild(visit);
		};
		source_file.forEachChild(visit);
		const aliases = new TypeScriptStaticKeyAliases();

		expect(accesses.map((expression) => aliases.object_property(expression, expression))).toEqual(["first", ""]);
	});
});
