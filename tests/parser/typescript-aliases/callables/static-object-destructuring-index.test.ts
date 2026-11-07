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
		const declaration = variable_statement?.declarationList.declarations[0];
		const values = new Map<string, string>();
		const bindings = new TypeScriptStaticExpressionBindings((resolved, name, initializer) => {
			if (!ts.isStringLiteral(initializer)) {
				return false;
			}
			resolved.set(name, initializer.text);
			return true;
		});
		let changed = false;
		if (declaration !== undefined) {
			changed = bindings.append(values, declaration);
		}

		expect({ changed, values: [...values.entries()] }).toEqual({ changed: false, values: [] });
	});

	test("resolves the last matching property across object spreads", () => {
		const source = ts.createSourceFile(
			"spread.ts",
			'const base = { key: "old" }; const value = { ...base, key: "new" };',
			ts.ScriptTarget.Latest,
			true,
		);
		const statements = source.statements.filter(ts.isVariableStatement);
		const base = statements[0]?.declarationList.declarations[0]?.initializer;
		const value = statements[1]?.declarationList.declarations[0]?.initializer;
		const values = new TypeScriptStaticObjectValues(new Map(), new Map());
		let result = "";
		if (base !== undefined && ts.isObjectLiteralExpression(base)) {
			values.append_object("base", base);
		}
		if (value !== undefined && ts.isObjectLiteralExpression(value)) {
			result = values.property_value(value, "key");
		}

		expect(result).toBe("new");
	});
});
