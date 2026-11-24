import { describe, expect, test } from "@jest/globals";
import { TypeScriptStaticKeyAliases } from "src/parser/type_script_static_key_aliases";
import { TypeScriptStaticKeyState } from "src/parser/typescript-aliases/callables/type_script_static_key_state";
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
		const scope = source_file.statements.find(ts.isFunctionDeclaration);
		let has_result = false;
		let property_aliases: string[] = [];
		if (scope !== undefined) {
			const state = new TypeScriptStaticKeyState(scope);
			has_result = state.collect().objects.has("result");
			property_aliases = accesses.map((expression) => aliases.object_property(expression, expression));
		}
		expect({
			scope_found: scope !== undefined,
			has_result,
			property_aliases,
		}).toEqual({ scope_found: true, has_result: true, property_aliases: ["current"] });
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
