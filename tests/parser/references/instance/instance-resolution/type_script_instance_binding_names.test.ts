import { describe, expect, test } from "@jest/globals";
import { TypeScriptInstanceBindingNames } from "src/parser/references/instance/instance-resolution/type_script_instance_binding_names";
import ts from "typescript";

describe("TypeScript instance binding names", () => {
	test("collects names from nested declarations and assignment targets", () => {
		const source = ts.createSourceFile(
			"scope.ts",
			"const { first, nested: [second] } = value;\ntarget = new Service();",
			ts.ScriptTarget.Latest,
			true,
		);
		const resolver = new TypeScriptInstanceBindingNames();
		const declaration = source.statements.find(ts.isVariableStatement);
		const assignment = source.statements.find(ts.isExpressionStatement);
		let names: readonly string[] = [];
		if (declaration !== undefined) {
			names = declaration.declarationList.declarations.flatMap((item) => resolver.names(item));
		}
		let target = "";
		if (assignment !== undefined) {
			target = resolver.assignment_target(assignment.expression);
		}
		expect({ names, target }).toEqual({ names: ["first", "second"], target: "target" });
	});

	test("reuses binding-name results for the same parsed node", () => {
		const source = ts.createSourceFile("scope.ts", "const item = new Service();", ts.ScriptTarget.Latest, true);
		const declarations = source.statements.flatMap((statement) => {
			if (!ts.isVariableStatement(statement)) {
				return [];
			}
			return statement.declarationList.declarations;
		});
		const resolver = new TypeScriptInstanceBindingNames();
		const first_results = declarations.map((declaration) => resolver.names(declaration));
		const second_results = declarations.map((declaration) => resolver.names(declaration));
		expect({
			names: first_results.flat(),
			cached: first_results.every((first_result) => second_results.includes(first_result)),
		}).toEqual({
			names: ["item"],
			cached: true,
		});
	});
});
