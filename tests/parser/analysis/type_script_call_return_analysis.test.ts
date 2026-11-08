import { describe, expect, test } from "@jest/globals";
import { TypeScriptCallReturnAnalysis } from "src/parser/type_script_call_return_analysis";
import ts from "typescript";

describe("TypeScript call return analysis cache", () => {
	test("reuses the resolved owner for the same type node", () => {
		const source_file = ts.createSourceFile(
			"calls.ts",
			"function load(): Widget { return new Widget(); }",
			ts.ScriptTarget.Latest,
			true,
		);
		const function_declaration = source_file.statements.find(ts.isFunctionDeclaration);
		let type_node: ts.TypeNode | undefined;
		if (function_declaration !== undefined) {
			type_node = function_declaration.type;
		}
		const analysis = new TypeScriptCallReturnAnalysis();

		let first_owner = "missing";
		if (type_node !== undefined) {
			first_owner = analysis.reference_owner(type_node);
		}
		let second_owner = "missing";
		if (type_node !== undefined) {
			second_owner = analysis.reference_owner(type_node);
		}

		expect([first_owner, second_owner]).toEqual(["Widget", "Widget"]);
	});

	test("returns an empty owner for repeated queries of an anonymous result", () => {
		const source_file = ts.createSourceFile("calls.ts", "function run(): void {}", ts.ScriptTarget.Latest, true);
		const function_declaration = source_file.statements.find(ts.isFunctionDeclaration);
		let type_node: ts.TypeNode | undefined;
		if (function_declaration !== undefined) {
			type_node = function_declaration.type;
		}
		const analysis = new TypeScriptCallReturnAnalysis();

		let first_owner = "missing";
		if (type_node !== undefined) {
			first_owner = analysis.reference_owner(type_node);
		}
		let second_owner = "missing";
		if (type_node !== undefined) {
			second_owner = analysis.reference_owner(type_node);
		}

		expect([first_owner, second_owner]).toEqual(["", ""]);
	});
});
