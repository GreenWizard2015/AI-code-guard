import assert from "node:assert/strict";
import { describe, expect, test } from "@jest/globals";
import { TypeScriptStaticExpressionBindings } from "src/parser/typescript-aliases/callables/type_script_static_expression_bindings";
import { TypeScriptStaticObjectValues } from "src/parser/typescript-aliases/callables/type_script_static_object_values";
import { ObjectPropertyInventoryScenario } from "tests/parser/typescript-aliases/callables/object-property-inventory-scenario";
import ts from "typescript";

describe("static object destructuring index", () => {
	test("resolves multiple bindings from one object literal", () => {
		const scenario = new ObjectPropertyInventoryScenario();
		const [value, binding] = scenario.declarations();
		const bindings = new TypeScriptStaticExpressionBindings((values, name, initializer) => {
			if (!ts.isStringLiteral(initializer)) {
				return false;
			}
			values.set(name, initializer.text);
			return true;
		});
		const resolved_values = new Map<string, string>();

		if (value !== undefined && binding !== undefined) {
			bindings.append(resolved_values, value);
			bindings.append(resolved_values, binding);
		}

		expect([...resolved_values.entries()]).toEqual([
			["first", "one"],
			["second", "two"],
		]);
	});

	test("keeps bindings unresolved when their source is absent", () => {
		const source = ts.createSourceFile("missing.ts", "const { missing } = absent;", ts.ScriptTarget.Latest, true);
		const variable_statement = source.statements.find(ts.isVariableStatement);
		assert.ok(variable_statement);
		const declaration = variable_statement.declarationList.declarations[0];
		assert.ok(declaration);
		const values = new Map<string, string>();
		const bindings = new TypeScriptStaticExpressionBindings((resolved, name, initializer) => {
			if (!ts.isStringLiteral(initializer)) {
				return false;
			}
			resolved.set(name, initializer.text);
			return true;
		});
		const changed = bindings.append(values, declaration);

		expect({ changed, values: [...values.entries()] }).toEqual({ changed: false, values: [] });
	});

	test("resolves a property inherited through an object spread", () => {
		const base = ts.factory.createObjectLiteralExpression([
			ts.factory.createPropertyAssignment("key", ts.factory.createStringLiteral("inherited")),
		]);
		const value = ts.factory.createObjectLiteralExpression([
			ts.factory.createSpreadAssignment(ts.factory.createIdentifier("base")),
		]);
		const values = new TypeScriptStaticObjectValues(new Map(), new Map());
		values.append_object("base", base);
		const result = values.property_value(value, "key");

		expect(result).toBe("inherited");
	});

	test("resolves the last matching property after an object spread", () => {
		const base = ts.factory.createObjectLiteralExpression([
			ts.factory.createPropertyAssignment("key", ts.factory.createStringLiteral("old")),
		]);
		const value = ts.factory.createObjectLiteralExpression([
			ts.factory.createSpreadAssignment(ts.factory.createIdentifier("base")),
			ts.factory.createPropertyAssignment("key", ts.factory.createStringLiteral("new")),
		]);
		const values = new TypeScriptStaticObjectValues(new Map(), new Map());
		values.append_object("base", base);

		expect(values.property_value(value, "key")).toBe("new");
	});
});
