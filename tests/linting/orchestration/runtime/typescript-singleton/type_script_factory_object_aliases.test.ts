import { describe, expect, test } from "@jest/globals";
import { TypeScriptFactoryObjectAliases } from "src/linting/orchestration/runtime/typescript-singleton/type_script_factory_object_aliases";
import ts from "typescript";

describe("factory object aliases", () => {
	test("resolves a destructured binding source from a module object alias", () => {
		const source_file = ts.createSourceFile(
			"factory.ts",
			"const source = { local: provider };",
			ts.ScriptTarget.Latest,
			true,
		);
		const binding = ts.factory.createObjectBindingPattern([
			ts.factory.createBindingElement(
				undefined,
				ts.factory.createIdentifier("local"),
				ts.factory.createIdentifier("target"),
				undefined,
			),
		]);
		const declaration = ts.factory.createVariableDeclaration(
			binding,
			undefined,
			undefined,
			ts.factory.createIdentifier("source"),
		);
		const aliases = new TypeScriptFactoryObjectAliases(source_file);

		expect(aliases.source(declaration, "target")).toBe("provider");
	});

	test("collects callable expressions for destructured bindings and property access", () => {
		const source_file = ts.createSourceFile(
			"factory.ts",
			"const source = { local: () => value };",
			ts.ScriptTarget.Latest,
			true,
		);
		const binding = ts.factory.createObjectBindingPattern([
			ts.factory.createBindingElement(
				undefined,
				ts.factory.createIdentifier("local"),
				ts.factory.createIdentifier("target"),
				undefined,
			),
		]);
		const declaration = ts.factory.createVariableDeclaration(
			binding,
			undefined,
			undefined,
			ts.factory.createIdentifier("source"),
		);
		const aliases = new TypeScriptFactoryObjectAliases(source_file);
		const expressions = new Map<string, ts.FunctionLikeDeclarationBase>();
		aliases.append_expression(declaration, "target", expressions);
		const expression = ts.factory.createPropertyAccessExpression(ts.factory.createIdentifier("source"), "local");
		const bodies = aliases.property_bodies(expression);

		expect({ alias_count: expressions.size, body_count: bodies.length, body_kind: bodies[0]?.kind }).toEqual({
			alias_count: 1,
			body_count: 1,
			body_kind: ts.SyntaxKind.ArrowFunction,
		});
	});
});
