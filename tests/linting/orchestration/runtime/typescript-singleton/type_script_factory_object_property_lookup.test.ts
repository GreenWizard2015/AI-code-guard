import { describe, expect, test } from "@jest/globals";
import { TypeScriptFactoryObjectPropertyLookup } from "src/linting/orchestration/runtime/typescript-singleton/type_script_factory_object_property_lookup";
import { TypeScriptExpressionNames } from "src/parser/typescript-aliases/type_script_expression_names";
import ts from "typescript";

describe("factory object property lookup", () => {
	test("resolves a property source through an object spread alias", () => {
		const base = ts.factory.createObjectLiteralExpression([
			ts.factory.createPropertyAssignment("create", ts.factory.createIdentifier("provider")),
		]);
		const current = ts.factory.createObjectLiteralExpression([
			ts.factory.createSpreadAssignment(ts.factory.createIdentifier("base")),
		]);
		const lookup = new TypeScriptFactoryObjectPropertyLookup(
			current,
			"create",
			new Map([["base", base]]),
			new TypeScriptExpressionNames(),
			new Map(),
		);

		expect(lookup.source()).toBe("provider");
	});

	test("returns a function expression for the requested property", () => {
		const callable = ts.factory.createArrowFunction(
			undefined,
			undefined,
			[],
			undefined,
			ts.factory.createToken(ts.SyntaxKind.EqualsGreaterThanToken),
			ts.factory.createIdentifier("value"),
		);
		const initializer = ts.factory.createObjectLiteralExpression([
			ts.factory.createPropertyAssignment("create", callable),
		]);
		const lookup = new TypeScriptFactoryObjectPropertyLookup(
			initializer,
			"create",
			new Map(),
			new TypeScriptExpressionNames(),
			new Map(),
		);
		const expressions = lookup.expressions();
		const expression_list = Array.from(expressions.values());
		expect(expression_list.map((expression) => expression.kind)).toEqual([ts.SyntaxKind.ArrowFunction]);
	});
});
