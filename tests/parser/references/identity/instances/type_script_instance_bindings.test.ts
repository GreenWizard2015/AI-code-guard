import { describe, expect, test } from "@jest/globals";
import { TypeScriptInstanceBindings } from "src/parser/references/identity/instances/type_script_instance_bindings";
import ts from "typescript";

describe("TypeScript instance bindings", () => {
	test("preserves insertion order for bindings with the same scoped name", () => {
		const bindings = new TypeScriptInstanceBindings();
		const first_scope = ts.factory.createBlock([], false);
		const first_declaration = ts.factory.createIdentifier("first");
		const second_declaration = ts.factory.createIdentifier("second");

		bindings.add(first_scope, "value", first_declaration, "FirstOwner");
		bindings.add(first_scope, "value", second_declaration, "SecondOwner");

		expect(bindings.bindings(first_scope, "value")).toEqual([
			{ declaration: first_declaration, owner: "FirstOwner" },
			{ declaration: second_declaration, owner: "SecondOwner" },
		]);
	});

	test("isolates names by lexical scope and returns no bindings for missing names", () => {
		const bindings = new TypeScriptInstanceBindings();
		const first_scope = ts.factory.createBlock([], false);
		const second_scope = ts.factory.createBlock([], false);
		const declaration = ts.factory.createIdentifier("value");
		bindings.add(first_scope, "value", declaration, "FirstOwner");
		bindings.add(second_scope, "value", declaration, "SecondOwner");

		expect({
			first_scope: bindings.bindings(first_scope, "value"),
			second_scope: bindings.bindings(second_scope, "value"),
			missing_name: bindings.bindings(first_scope, "missing"),
		}).toEqual({
			first_scope: [{ declaration, owner: "FirstOwner" }],
			second_scope: [{ declaration, owner: "SecondOwner" }],
			missing_name: [],
		});
	});
});
