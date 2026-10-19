import { describe, expect, jest, test } from "@jest/globals";
import ts from "typescript";
import { TypeScriptStaticExpressionOperations } from "src/typescript-aliases/callables/type_script_static_expression_operations";

describe("static expression conditional resolution", () => {
	test("does not iterate unrelated bindings to resolve equal literal branches", () => {
		const source = ts.createSourceFile(
			"branch.ts",
			'const field_key = flag ? "field" : "field";',
			ts.ScriptTarget.Latest,
			true,
		);
		const variable_statement = source.statements.find(ts.isVariableStatement);
		const declaration = variable_statement?.declarationList.declarations[0];
		const initializer = declaration?.initializer;
		const values = new Map(Array.from({ length: 1000 }, (_, index) => [`unrelated_${index}`, "value"]));
		const iteration = jest.spyOn(values, Symbol.iterator);
		const operations = new TypeScriptStaticExpressionOperations();

		let resolved = false;
		if (initializer !== undefined) {
			resolved = operations.append(values, "field_key", initializer);
		}

		expect({ resolved, value: values.get("field_key"), iterated: iteration.mock.calls.length > 0 }).toEqual({
			resolved: true,
			value: "field",
			iterated: false,
		});
	});

	test("does not resolve unequal literal branches", () => {
		const source = ts.createSourceFile(
			"branch.ts",
			'const key = flag ? "left" : "right";',
			ts.ScriptTarget.Latest,
			true,
		);
		const variable_statement = source.statements.find(ts.isVariableStatement);
		const declaration = variable_statement?.declarationList.declarations[0];
		const initializer = declaration?.initializer;
		const values = new Map<string, string>();
		const operations = new TypeScriptStaticExpressionOperations();
		let resolved = false;
		if (initializer !== undefined) {
			resolved = operations.append(values, "key", initializer);
		}

		expect({ resolved, value: values.get("key") }).toEqual({ resolved: false, value: undefined });
	});
});
