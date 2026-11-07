import { describe, expect, test } from "@jest/globals";
import { TypeScriptStaticExpressionOperations } from "src/parser/typescript-aliases/type_script_static_expression_operations";
import ts from "typescript";

describe("static expression conditional resolution", () => {
	test("resolves equal literal branches with unrelated bindings present", () => {
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
		const operations = new TypeScriptStaticExpressionOperations();

		let resolved = false;
		if (initializer !== undefined) {
			resolved = operations.append(values, "field_key", initializer);
		}

		expect({ resolved, value: values.get("field_key") }).toEqual({
			resolved: true,
			value: "field",
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

	test("stores resolved expressions only after evaluating the complete value", () => {
		const source = ts.createSourceFile(
			"comma-expression.ts",
			'const source_value = "source"; const copied_value = (source_value, "final");',
			ts.ScriptTarget.Latest,
			true,
		);
		const declarations = source.statements
			.filter(ts.isVariableStatement)
			.flatMap((statement) => statement.declarationList.declarations);
		const values = new Map<string, string>();
		const operations = new TypeScriptStaticExpressionOperations();
		const first_initializer = declarations[0]?.initializer;
		const second_initializer = declarations[1]?.initializer;
		let first_resolved = false;
		let second_resolved = false;
		if (first_initializer !== undefined) {
			first_resolved = operations.append(values, "source_value", first_initializer);
		}
		if (second_initializer !== undefined) {
			second_resolved = operations.append(values, "copied_value", second_initializer);
		}

		expect({ first_resolved, second_resolved, values: [...values] }).toEqual({
			first_resolved: true,
			second_resolved: true,
			values: [
				["source_value", "source"],
				["copied_value", "final"],
			],
		});
	});
});
