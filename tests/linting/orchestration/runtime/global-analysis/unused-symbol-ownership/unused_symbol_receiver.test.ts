import { describe, expect, test } from "@jest/globals";
import { UnusedSymbolReceiver } from "src/linting/orchestration/runtime/global-analysis/unused-symbol-ownership/unused_symbol_receiver";
import ts from "typescript";

describe("unused symbol receiver type lookup", () => {
	test("resolves an explicitly typed parameter", () => {
		const source = ts.createSourceFile(
			"owner.ts",
			"class Owner {}\nfunction inspect(value: Owner): void {}",
			ts.ScriptTarget.Latest,
			true,
		);
		const function_node = source.statements.at(1);
		const receiver = new UnusedSymbolReceiver();
		let result = "";
		if (function_node !== undefined && ts.isFunctionDeclaration(function_node)) {
			const parameter = function_node.parameters[0];
			if (parameter !== undefined && ts.isIdentifier(parameter.name)) {
				result = receiver.type(source, parameter.name);
			}
		}
		expect(result).toBe("Owner");
	});

	test("resolves an explicitly typed variable", () => {
		const source = ts.createSourceFile(
			"owner.ts",
			"class Owner {}\nconst value: Owner = new Owner();",
			ts.ScriptTarget.Latest,
			true,
		);
		const statement = source.statements.at(1);
		const receiver = new UnusedSymbolReceiver();
		let result = "";
		if (statement !== undefined && ts.isVariableStatement(statement)) {
			const declaration = statement.declarationList.declarations[0];
			if (declaration !== undefined && ts.isIdentifier(declaration.name)) {
				result = receiver.type(source, declaration.name);
			}
		}
		expect(result).toBe("Owner");
	});

	test("does not classify an untyped parameter or property", () => {
		const source = ts.createSourceFile(
			"owner.ts",
			"function inspect(value: unknown): void {}",
			ts.ScriptTarget.Latest,
			true,
		);
		const function_node = source.statements.at(0);
		const receiver = new UnusedSymbolReceiver();
		let parameter_type = "";
		if (function_node !== undefined && ts.isFunctionDeclaration(function_node)) {
			const parameter = function_node.parameters[0];
			if (parameter !== undefined && ts.isIdentifier(parameter.name)) {
				parameter_type = receiver.type(source, parameter.name);
			}
		}
		const property_type = receiver.type(
			source,
			ts.factory.createPropertyAccessExpression(ts.factory.createIdentifier("value"), "field"),
		);
		expect([parameter_type, property_type]).toEqual(["", ""]);
	});
});
